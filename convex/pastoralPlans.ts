import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessTeen, filterTeensByScope, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

const priority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));
const planStatus = v.union(v.literal("active"), v.literal("completed"), v.literal("paused"));
const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

async function requireTeenAccess(ctx: any, token: string, teenId: any) {
  const access = await requireAccess(ctx, token, "helper");
  const teen = await ctx.db.get(teenId);
  if (!teen) throw new Error("Adolescente no encontrado.");
  if (!canAccessTeen(access, teen)) throw new Error("No tienes acceso a este adolescente.");
  return { access, teen };
}

async function withAssignedName(ctx: any, plan: any) {
  const assigned = plan.assignedToUserId ? await ctx.db.get(plan.assignedToUserId) : null;
  return { ...plan, assignedName: assigned?.name || "" };
}

export const getByTeen = query({
  args: { token: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    await requireTeenAccess(ctx, args.token, args.teenId);
    const plan = await ctx.db
      .query("pastoralPlans")
      .withIndex("by_teenId_status", (q) => q.eq("teenId", args.teenId).eq("status", "active"))
      .first();
    return plan ? await withAssignedName(ctx, plan) : null;
  },
});

export const upsertActive = mutation({
  args: {
    token: v.string(),
    teenId: v.id("teens"),
    currentState: v.string(),
    mainNeed: v.string(),
    monthlyGoal: v.string(),
    recommendedAction: v.string(),
    assignedToUserId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    followUpResult: v.optional(v.string()),
    priority,
    status: v.optional(planStatus),
  },
  handler: async (ctx, args) => {
    await requireTeenAccess(ctx, args.token, args.teenId);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("pastoralPlans")
      .withIndex("by_teenId_status", (q) => q.eq("teenId", args.teenId).eq("status", "active"))
      .first();
    const values = {
      currentState: args.currentState.trim(),
      mainNeed: args.mainNeed.trim(),
      monthlyGoal: args.monthlyGoal.trim(),
      recommendedAction: args.recommendedAction.trim(),
      assignedToUserId: args.assignedToUserId,
      dueDate: args.dueDate,
      followUpResult: args.followUpResult?.trim(),
      priority: args.priority,
      status: args.status ?? "active",
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      await logAudit(ctx, {
        token: args.token,
        action: "pastoral_plan.updated",
        entityType: "pastoralPlan",
        entityId: String(existing._id),
        previousValue: existing,
        newValue: { teenId: args.teenId, ...values },
      });
      return existing._id;
    }
    const id = await ctx.db.insert("pastoralPlans", {
      teenId: args.teenId,
      ...values,
      createdAt: now,
    });
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_plan.created",
      entityType: "pastoralPlan",
      entityId: String(id),
      newValue: { teenId: args.teenId, ...values },
    });
    return id;
  },
});

export const complete = mutation({
  args: {
    token: v.string(),
    planId: v.id("pastoralPlans"),
    followUpResult: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan no encontrado.");
    await requireTeenAccess(ctx, args.token, plan.teenId);
    const patch = {
      status: "completed" as const,
      followUpResult: args.followUpResult?.trim() || plan.followUpResult,
      updatedAt: new Date().toISOString(),
    };
    await ctx.db.patch(args.planId, patch);
    await logAudit(ctx, {
      token: args.token,
      action: "pastoral_plan.completed",
      entityType: "pastoralPlan",
      entityId: String(args.planId),
      previousValue: plan,
      newValue: { ...plan, ...patch },
    });
  },
});

export const listByPriority = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect());
    const allowedIds = new Set(teens.map((teen) => teen._id));
    const plans = (await ctx.db.query("pastoralPlans").collect())
      .filter((plan) => plan.status === "active" && allowedIds.has(plan.teenId));
    const enriched = await Promise.all(plans.map(async (plan) => {
      const teen = await ctx.db.get(plan.teenId);
      const withName = await withAssignedName(ctx, plan);
      return { ...withName, teenName: teen ? `${teen.nombre} ${teen.apellido}` : "Adolescente" };
    }));
    return enriched.sort((a, b) => {
      const priorityDelta = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDelta) return priorityDelta;
      return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    });
  },
});
