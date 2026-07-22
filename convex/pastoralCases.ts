import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessTeen, normalizeRole, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

const priority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));
const status = v.union(v.literal("open"), v.literal("in_progress"), v.literal("referred"), v.literal("review_pending"), v.literal("closed"));
const supervisors = new Set(["administrador", "pastor", "director", "coordinador"]);

async function accessTeen(ctx: any, token: string, teenId: any) {
  const access = await requireAccess(ctx, token, "helper"); const teen = await ctx.db.get(teenId);
  if (!teen || !canAccessTeen(access, teen)) throw new Error("No tienes acceso a este adolescente.");
  return { access, teen, isSupervisor: supervisors.has(normalizeRole(access.user.role)) };
}

export const listByTeen = query({ args: { token: v.string(), teenId: v.id("teens") }, handler: async (ctx, args) => {
  const { access, isSupervisor } = await accessTeen(ctx, args.token, args.teenId);
  const cases = await ctx.db.query("pastoralCases").withIndex("by_teenId", q => q.eq("teenId", args.teenId)).collect();
  return cases.filter(item => isSupervisor || item.assignedToUserId === access.user._id);
}});

export const listActions = query({ args: { token: v.string(), caseId: v.id("pastoralCases") }, handler: async (ctx, args) => {
  const item = await ctx.db.get(args.caseId); if (!item) return [];
  const { access, isSupervisor } = await accessTeen(ctx, args.token, item.teenId);
  if (!isSupervisor && item.assignedToUserId !== access.user._id) throw new Error("No tienes acceso a este caso.");
  return await ctx.db.query("pastoralCaseActions").withIndex("by_caseId", q => q.eq("caseId", args.caseId)).order("desc").collect();
}});

export const create = mutation({ args: { token: v.string(), teenId: v.id("teens"), title: v.string(), priority, assignedToUserId: v.optional(v.id("users")), supervisorUserId: v.optional(v.id("users")), reviewDueDate: v.optional(v.string()), relatedCrisisAlertId: v.optional(v.id("crisisAlerts")) }, handler: async (ctx, args) => {
  const { access, isSupervisor } = await accessTeen(ctx, args.token, args.teenId); if (!isSupervisor) throw new Error("Solo coordinación o supervisión puede abrir expedientes sensibles.");
  const now = new Date().toISOString(); const id = await ctx.db.insert("pastoralCases", { ...args, title: args.title.trim(), status: "open", createdByUserId: access.user._id, createdAt: now, updatedAt: now });
  await ctx.db.insert("pastoralCaseActions", { caseId: id, actorUserId: access.user._id, type: "note", notes: "Caso abierto.", createdAt: now });
  await logAudit(ctx, { token: args.token, action: "pastoral_case.created", entityType: "pastoralCase", entityId: String(id), newValue: { teenId: args.teenId, priority: args.priority }, sensitivityLevel: "sensitive" }); return id;
}});

export const addAction = mutation({ args: { token: v.string(), caseId: v.id("pastoralCases"), notes: v.string() }, handler: async (ctx, args) => {
  const item = await ctx.db.get(args.caseId); if (!item) throw new Error("Caso no encontrado."); const { access, isSupervisor } = await accessTeen(ctx, args.token, item.teenId);
  if (!isSupervisor && item.assignedToUserId !== access.user._id) throw new Error("Solo el responsable asignado puede agregar notas.");
  const now = new Date().toISOString(); const id = await ctx.db.insert("pastoralCaseActions", { caseId: item._id, actorUserId: access.user._id, type: "note", notes: args.notes.trim(), createdAt: now }); await ctx.db.patch(item._id, { updatedAt: now });
  await logAudit(ctx, { token: args.token, action: "pastoral_case.note_added", entityType: "pastoralCase", entityId: String(item._id), newValue: { notes: true }, sensitivityLevel: "sensitive" }); return id;
}});

export const updateStatus = mutation({ args: { token: v.string(), caseId: v.id("pastoralCases"), status, notes: v.string() }, handler: async (ctx, args) => {
  const item = await ctx.db.get(args.caseId); if (!item) throw new Error("Caso no encontrado."); const { access, isSupervisor } = await accessTeen(ctx, args.token, item.teenId);
  if (!isSupervisor) throw new Error("Solo supervisión puede derivar o cerrar expedientes.");
  const now = new Date().toISOString(); const actionType = args.status === "referred" ? "referred" : args.status === "closed" ? "closed" : "reviewed";
  await ctx.db.patch(item._id, { status: args.status, updatedAt: now, closedAt: args.status === "closed" ? now : undefined }); await ctx.db.insert("pastoralCaseActions", { caseId: item._id, actorUserId: access.user._id, type: actionType, notes: args.notes.trim(), createdAt: now });
  await logAudit(ctx, { token: args.token, action: "pastoral_case.status_changed", entityType: "pastoralCase", entityId: String(item._id), previousValue: { status: item.status }, newValue: { status: args.status }, sensitivityLevel: "sensitive" });
}});
