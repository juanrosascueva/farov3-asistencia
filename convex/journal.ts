import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journal")
      .withIndex("by_teenId_and_date", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    teenId: v.id("teens"),
    entryDate: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("call"),
      v.literal("visit"),
      v.literal("chat"),
      v.literal("counseling"),
      v.literal("prayer"),
      v.literal("other")
    ),
    leaderName: v.string(),
    followUp: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("journal", args);
  },
});

export const remove = mutation({
  args: { id: v.id("journal") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const listAll = query({
  handler: async (ctx) => {
    return await ctx.db.query("journal").order("desc").collect();
  },
});

export const listFollowUps = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("journal")
      .withIndex("by_followUp", (q) => q.eq("followUp", true))
      .order("desc")
      .collect();
  },
});
