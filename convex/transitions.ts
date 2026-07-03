import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessTeen, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

async function requireTransitionAccess(ctx: any, token: string | undefined, teenId: any) {
  const teen = await ctx.db.get(teenId);
  if (!teen) throw new Error("Ficha no encontrada");
  const access = await requireAccess(ctx, token, "coordinador");
  if (!canAccessTeen(access, teen)) throw new Error("No autorizado");
  if (!teen.personId) throw new Error("La ficha aún no tiene persona base. Ejecuta la migración de personas.");
  return { teen, access };
}

export const listByTeen = query({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const teen = await ctx.db.get(args.teenId);
    if (!teen) return [];
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, teen)) throw new Error("No autorizado");
    return await ctx.db
      .query("ministryTransitions")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .collect();
  },
});

export const create = mutation({
  args: {
    teenId: v.id("teens"),
    token: v.optional(v.string()),
    toMinistryKey: v.string(),
    targetDate: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { teen, access } = await requireTransitionAccess(ctx, args.token, args.teenId);
    const now = new Date().toISOString();
    const id = await ctx.db.insert("ministryTransitions", {
      personId: teen.personId,
      teenId: args.teenId,
      fromMinistryKey: "teens",
      toMinistryKey: args.toMinistryKey.trim() || "jovenes",
      fromGroupId: teen.groupId,
      status: "planned",
      reason: args.reason?.trim(),
      targetDate: args.targetDate,
      createdByUserId: access.user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      token: args.token,
      action: "transition.created",
      entityType: "ministryTransition",
      entityId: String(id),
      newValue: { teenId: args.teenId, toMinistryKey: args.toMinistryKey, targetDate: args.targetDate },
      details: `${teen.nombre} ${teen.apellido}`,
    });
    return id;
  },
});

export const complete = mutation({
  args: { id: v.id("ministryTransitions"), token: v.optional(v.string()), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const transition = await ctx.db.get(args.id);
    if (!transition) throw new Error("Transición no encontrada");
    const { teen } = await requireTransitionAccess(ctx, args.token, transition.teenId);
    const now = new Date().toISOString();
    const activeEnrollment = await ctx.db
      .query("ministryEnrollments")
      .withIndex("by_teenId", (q) => q.eq("teenId", transition.teenId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
    if (activeEnrollment) {
      await ctx.db.patch(activeEnrollment._id, { status: "graduated", endedAt: now.slice(0, 10), updatedAt: now });
    }
    await ctx.db.patch(transition.teenId, { estado: "egresado", motivoInactividad: args.notes || transition.reason || "Transición ministerial completada" });
    await ctx.db.patch(args.id, { status: "completed", completedAt: now, updatedAt: now });
    await logAudit(ctx, {
      token: args.token,
      action: "transition.completed",
      entityType: "ministryTransition",
      entityId: String(args.id),
      previousValue: { status: transition.status, teenStatus: teen.estado },
      newValue: { status: "completed", teenStatus: "egresado", notes: args.notes },
      details: `${teen.nombre} ${teen.apellido}`,
    });
  },
});

export const cancel = mutation({
  args: { id: v.id("ministryTransitions"), token: v.optional(v.string()), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const transition = await ctx.db.get(args.id);
    if (!transition) throw new Error("Transición no encontrada");
    const { teen } = await requireTransitionAccess(ctx, args.token, transition.teenId);
    const now = new Date().toISOString();
    await ctx.db.patch(args.id, { status: "canceled", reason: args.reason || transition.reason, updatedAt: now });
    await logAudit(ctx, {
      token: args.token,
      action: "transition.canceled",
      entityType: "ministryTransition",
      entityId: String(args.id),
      previousValue: { status: transition.status },
      newValue: { status: "canceled", reason: args.reason },
      details: `${teen.nombre} ${teen.apellido}`,
    });
  },
});
