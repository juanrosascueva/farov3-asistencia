import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";
import { canAccessTeen, filterTeensByScope, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

const priority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));
const taskStatus = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("rescheduled"),
  v.literal("canceled"),
  v.literal("escalated")
);
const taskSource = v.union(v.literal("manual"), v.literal("plan"), v.literal("crisis"), v.literal("ai"));

const openStatuses = new Set(["pending", "in_progress", "rescheduled", "escalated"]);
const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

async function requireTeenAccess(ctx: any, token: string | undefined, teenId: any) {
  const access = await requireAccess(ctx, token, "helper");
  const teen = await ctx.db.get(teenId);
  if (!teen) throw new Error("Adolescente no encontrado.");
  if (!canAccessTeen(access, teen)) throw new Error("No tienes acceso a este adolescente.");
  return { access, teen };
}

async function withNames(ctx: any, task: any) {
  const teen = await ctx.db.get(task.teenId);
  const assigned = task.assignedToUserId ? await ctx.db.get(task.assignedToUserId) : null;
  return {
    ...task,
    teenName: teen ? `${teen.nombre} ${teen.apellido}` : "Adolescente",
    teenPhoto: teen?.foto || "",
    assignedName: assigned?.name || "",
  };
}

export const listAssignableUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester) throw new Error("No autorizado");
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.isActive)
      .map((u) => ({ _id: u._id, name: u.name, role: u.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listByTeen = query({
  args: { token: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    await requireTeenAccess(ctx, args.token, args.teenId);
    const tasks = await ctx.db
      .query("pastoralTasks")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .collect();
    const enriched = await Promise.all(tasks.map((task) => withNames(ctx, task)));
    return enriched.sort((a, b) => {
      const statusDelta = Number(openStatuses.has(b.status)) - Number(openStatuses.has(a.status));
      if (statusDelta) return statusDelta;
      const priorityDelta = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDelta) return priorityDelta;
      return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    });
  },
});

export const listOpenForDashboard = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const allTeens = await ctx.db.query("teens").collect();
    const allowedIds = new Set(filterTeensByScope(access, allTeens).map((teen) => teen._id));
    const tasks = (await ctx.db.query("pastoralTasks").collect())
      .filter((task) => allowedIds.has(task.teenId) && openStatuses.has(task.status));
    const enriched = await Promise.all(tasks.map((task) => withNames(ctx, task)));
    return enriched.sort((a, b) => {
      const priorityDelta = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDelta) return priorityDelta;
      return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    });
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    teenId: v.id("teens"),
    source: taskSource,
    title: v.string(),
    description: v.optional(v.string()),
    assignedToUserId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    priority,
    relatedPlanId: v.optional(v.id("pastoralPlans")),
    relatedCrisisAlertId: v.optional(v.id("crisisAlerts")),
  },
  handler: async (ctx, args) => {
    const { access } = await requireTeenAccess(ctx, args.token, args.teenId);
    const now = new Date().toISOString();
    const payload = {
      teenId: args.teenId,
      source: args.source,
      title: args.title.trim(),
      description: args.description?.trim(),
      assignedToUserId: args.assignedToUserId,
      dueDate: args.dueDate,
      priority: args.priority,
      status: "pending" as const,
      relatedPlanId: args.relatedPlanId,
      relatedCrisisAlertId: args.relatedCrisisAlertId,
      createdBy: access.user._id,
      createdAt: now,
      updatedAt: now,
    };
    const id = await ctx.db.insert("pastoralTasks", payload);
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_task.created",
      entityType: "pastoralTask",
      entityId: String(id),
      newValue: payload,
    });
    return id;
  },
});

export const updateStatus = mutation({
  args: {
    token: v.string(),
    taskId: v.id("pastoralTasks"),
    status: taskStatus,
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tarea no encontrada.");
    await requireTeenAccess(ctx, args.token, task.teenId);
    const patch = {
      status: args.status,
      completedAt: args.status === "done" ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };
    await ctx.db.patch(args.taskId, patch);
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_task.updated",
      entityType: "pastoralTask",
      entityId: String(args.taskId),
      previousValue: task,
      newValue: { ...task, ...patch },
      details: `Estado actualizado a ${args.status}.`,
    });
  },
});

export const reassign = mutation({
  args: {
    token: v.string(),
    taskId: v.id("pastoralTasks"),
    assignedToUserId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    priority: v.optional(priority),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Tarea no encontrada.");
    await requireTeenAccess(ctx, args.token, task.teenId);
    const patch = {
      assignedToUserId: args.assignedToUserId,
      dueDate: args.dueDate,
      priority: args.priority ?? task.priority,
      updatedAt: new Date().toISOString(),
    };
    await ctx.db.patch(args.taskId, patch);
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_task.updated",
      entityType: "pastoralTask",
      entityId: String(args.taskId),
      previousValue: task,
      newValue: { ...task, ...patch },
      details: "Tarea reasignada o reprogramada.",
    });
  },
});

export const remove = mutation({
  args: { token: v.string(), taskId: v.id("pastoralTasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return;
    await requireTeenAccess(ctx, args.token, task.teenId);
    await ctx.db.delete(args.taskId);
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_task.deleted",
      entityType: "pastoralTask",
      entityId: String(args.taskId),
      previousValue: task,
    });
  },
});

export const createInternal = internalMutation({
  args: {
    teenId: v.id("teens"),
    source: taskSource,
    title: v.string(),
    description: v.optional(v.string()),
    assignedToUserId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    priority,
    relatedPlanId: v.optional(v.id("pastoralPlans")),
    relatedCrisisAlertId: v.optional(v.id("crisisAlerts")),
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("pastoralTasks", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});
