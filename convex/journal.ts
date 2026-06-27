import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const list = query({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("journal")
      .withIndex("by_teenId_and_date", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
    // Filter out confidential entries for unauthorized users
    if (!args.token) return entries.filter(e => !e.isConfidential);
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director" && user.role !== "coordinador")) {
      return entries.filter(e => !e.isConfidential);
    }
    return entries;
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
    isConfidential: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
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
