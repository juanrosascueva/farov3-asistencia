import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

export const createAlert = internalMutation({
  args: {
    analysisId: v.id("journalAnalysis"),
    teenId: v.id("teens"),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("crisisAlerts", {
      analysisId: args.analysisId,
      teenId: args.teenId,
      summary: args.summary,
      status: "unattended",
      createdAt: new Date().toISOString(),
    });
  },
});

export const markAttended = mutation({
  args: {
    alertId: v.id("crisisAlerts"),
    attendedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, {
      status: "attended",
      attendedAt: new Date().toISOString(),
      attendedBy: args.attendedBy,
    });
  },
});

export const getUnattendedAlerts = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("crisisAlerts")
      .withIndex("by_status", (q) => q.eq("status", "unattended"))
      .order("desc")
      .collect();
  },
});

export const getAllAlerts = query({
  handler: async (ctx) => {
    return await ctx.db.query("crisisAlerts").order("desc").collect();
  },
});

export const getAlertsByTeen = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crisisAlerts")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
  },
});
