import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("attendance").collect();
  },
});

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
  },
});

export const getByTeen = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attendance")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .collect();
  },
});

export const mark = mutation({
  args: {
    date: v.string(),
    teenId: v.id("teens"),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("excused")
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_date_and_teen", (q) =>
        q.eq("date", args.date).eq("teenId", args.teenId)
      )
      .first();

    if (existing) {
      if (existing.status === args.status) {
        await ctx.db.delete(existing._id);
        return null;
      } else {
        await ctx.db.patch(existing._id, { status: args.status });
        return existing._id;
      }
    } else {
      return await ctx.db.insert("attendance", {
        date: args.date,
        teenId: args.teenId,
        status: args.status,
      });
    }
  },
});
