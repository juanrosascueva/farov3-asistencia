import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const list = query({
  args: { token: v.string(), userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    const targetId = args.userId || user._id;
    return await ctx.db
      .query("userScopes")
      .withIndex("by_userId", q => q.eq("userId", targetId))
      .collect();
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    role: v.union(
      v.literal("pastor"),
      v.literal("director"),
      v.literal("coordinador"),
      v.literal("leader"),
      v.literal("helper")
    ),
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester || requester.role !== "pastor") {
      throw new Error("No autorizado");
    }
    const id = await ctx.db.insert("userScopes", {
      userId: args.userId,
      role: args.role,
      campusId: args.campusId,
      ministryId: args.ministryId,
      groupId: args.groupId,
      assignedBy: requester._id,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("userScopes") },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester || requester.role !== "pastor") {
      throw new Error("No autorizado");
    }
    await ctx.db.delete(args.id);
  },
});
