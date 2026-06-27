import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUserFromToken } from "./authHelper";

export const log = mutation({
  args: {
    action: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      action: args.action,
      userId: args.userId,
      userName: args.userName,
      targetType: args.targetType,
      targetId: args.targetId,
      details: args.details,
      createdAt: new Date().toISOString(),
    });
  },
});

export const list = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || user.role !== "pastor") throw new Error("No autorizado");
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit ?? 50);
    return logs;
  },
});
