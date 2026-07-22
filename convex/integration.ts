import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessTeen, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

export const milestoneType = v.union(
  v.literal("registered"), v.literal("guardian_confirmed"), v.literal("first_attendance"),
  v.literal("group_assigned"), v.literal("first_contact"), v.literal("three_attendances"),
  v.literal("pastoral_conversation"), v.literal("discipleship_or_service")
);

async function getTeen(ctx: any, token: string, teenId: any) {
  const access = await requireAccess(ctx, token, "helper");
  const teen = await ctx.db.get(teenId);
  if (!teen || !canAccessTeen(access, teen)) throw new Error("No tienes acceso a este adolescente.");
  return { access, teen };
}

export const listByTeen = query({
  args: { token: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    await getTeen(ctx, args.token, args.teenId);
    return await ctx.db.query("integrationMilestones").withIndex("by_teenId", q => q.eq("teenId", args.teenId)).collect();
  },
});

export const complete = mutation({
  args: { token: v.string(), teenId: v.id("teens"), type: milestoneType, notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { access } = await getTeen(ctx, args.token, args.teenId);
    const existing = await ctx.db.query("integrationMilestones").withIndex("by_teen_type", q => q.eq("teenId", args.teenId).eq("type", args.type)).first();
    const now = new Date().toISOString();
    const value = { completedAt: now, completedByUserId: access.user._id, notes: args.notes?.trim() || undefined };
    if (existing) {
      await ctx.db.patch(existing._id, value);
      await logAudit(ctx, { token: args.token, action: "integration_milestone.updated", entityType: "integrationMilestone", entityId: String(existing._id), previousValue: existing, newValue: value });
      return existing._id;
    }
    const id = await ctx.db.insert("integrationMilestones", { teenId: args.teenId, type: args.type, ...value });
    await logAudit(ctx, { token: args.token, action: "integration_milestone.completed", entityType: "integrationMilestone", entityId: String(id), newValue: { teenId: args.teenId, type: args.type, ...value } });
    return id;
  },
});
