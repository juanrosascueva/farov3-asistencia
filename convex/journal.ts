import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";
import { logAudit } from "./auditLog";

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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { token, ...entry } = args;
    const id = await ctx.db.insert("journal", entry);
    await logAudit(ctx, {
      token,
      action: "journal.created",
      entityType: "journal",
      entityId: String(id),
      newValue: {
        teenId: entry.teenId,
        entryDate: entry.entryDate,
        category: entry.category,
        followUp: entry.followUp,
        isConfidential: entry.isConfidential === true,
      },
      details: "Entrada de bitacora pastoral creada.",
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("journal"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    await ctx.db.delete(args.id);
    if (current) {
      await logAudit(ctx, {
        token: args.token,
        action: "journal.deleted",
        entityType: "journal",
        entityId: String(args.id),
        previousValue: {
          teenId: current.teenId,
          entryDate: current.entryDate,
          category: current.category,
          followUp: current.followUp,
          isConfidential: current.isConfidential === true,
        },
        details: "Entrada de bitacora pastoral eliminada.",
      });
    }
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
