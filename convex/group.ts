import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";
import { logAudit } from "./auditLog";
import { reassignOpenTasksForTeen, resolveEffectiveLeader } from "./leaderAssignment";

export const list = query({
  args: { token: v.string(), ministryId: v.id("ministry") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return [];
    return await ctx.db
      .query("group")
      .withIndex("by_ministryId", q => q.eq("ministryId", args.ministryId))
      .collect();
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("group") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) return null;
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    ministryId: v.id("ministry"),
    name: v.string(),
    leaderId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor" && user.role !== "director" && user.role !== "coordinador")) {
      throw new Error("No autorizado");
    }
    const id = await ctx.db.insert("group", {
      ministryId: args.ministryId,
      name: args.name,
      leaderId: args.leaderId,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("group"),
    name: v.optional(v.string()),
    leaderId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor" && user.role !== "director" && user.role !== "coordinador")) {
      throw new Error("No autorizado");
    }
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Grupo no encontrado");
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.leaderId !== undefined) patch.leaderId = args.leaderId;
    await ctx.db.patch(args.id, patch);
    if (args.leaderId !== undefined && String(current.leaderId || "") !== String(args.leaderId || "")) {
      const teens = await ctx.db.query("teens").withIndex("by_groupId", (q: any) => q.eq("groupId", args.id)).collect();
      for (const teen of teens.filter((item) => !item.liderPrincipalId)) {
        const resolvedLeader = await resolveEffectiveLeader(ctx, { ...teen, groupId: args.id });
        await reassignOpenTasksForTeen(ctx, {
          teenId: teen._id,
          assignedToUserId: resolvedLeader.userId,
          token: args.token,
          reason: "Reasignación automática por cambio de líder del grupo.",
        });
      }
      await logAudit(ctx, {
        token: args.token,
        action: "group.leader_changed",
        entityType: "group",
        entityId: String(args.id),
        previousValue: { leaderId: current.leaderId },
        newValue: { leaderId: args.leaderId },
        details: "Líder de grupo actualizado y tareas abiertas reasignadas.",
      });
    }
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("group") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado");
    }
    await ctx.db.delete(args.id);
  },
});
