import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByWeek = query({
  args: { weekStart: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .collect();
  },
});

export const getCounts = query({
  args: { weekStart: v.string() },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("contacts")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .collect();
    let contacted = 0;
    let skipped = 0;
    let pending = 0;
    for (const t of tasks) {
      if (t.status === "contacted") contacted++;
      else if (t.status === "skipped") skipped++;
      else pending++;
    }
    return { total: tasks.length, contacted, skipped, pending };
  },
});

export const upsert = mutation({
  args: {
    weekStart: v.string(),
    teenId: v.id("teens"),
    status: v.union(
      v.literal("pending"),
      v.literal("contacted"),
      v.literal("skipped")
    ),
    leaderName: v.optional(v.string()),
    contactedAt: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_weekStart_and_teenId", (q) =>
        q.eq("weekStart", args.weekStart).eq("teenId", args.teenId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        leaderName: args.leaderName,
        contactedAt: args.contactedAt,
        notes: args.notes,
      });
    } else {
      await ctx.db.insert("contacts", args);
    }
  },
});

export const markContacted = mutation({
  args: {
    weekStart: v.string(),
    teenId: v.id("teens"),
    leaderName: v.string(),
    notes: v.optional(v.string()),
    createJournal: v.optional(v.boolean()),
    journalCategory: v.optional(
      v.union(
        v.literal("call"),
        v.literal("visit"),
        v.literal("chat"),
        v.literal("counseling"),
        v.literal("prayer"),
        v.literal("other")
      )
    ),
    journalContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_weekStart_and_teenId", (q) =>
        q.eq("weekStart", args.weekStart).eq("teenId", args.teenId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "contacted",
        leaderName: args.leaderName,
        contactedAt: now,
        notes: args.notes,
      });
    } else {
      await ctx.db.insert("contacts", {
        weekStart: args.weekStart,
        teenId: args.teenId,
        status: "contacted",
        leaderName: args.leaderName,
        contactedAt: now,
        notes: args.notes,
      });
    }
    if (args.createJournal && args.journalCategory) {
      await ctx.db.insert("journal", {
        teenId: args.teenId,
        entryDate: now.slice(0, 10),
        content: args.journalContent || `Contacto semanal (campaña: ${args.weekStart})`,
        category: args.journalCategory,
        leaderName: args.leaderName,
        followUp: false,
      });
    }
  },
});

export const markSkipped = mutation({
  args: { weekStart: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_weekStart_and_teenId", (q) =>
        q.eq("weekStart", args.weekStart).eq("teenId", args.teenId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "skipped" });
    } else {
      await ctx.db.insert("contacts", {
        weekStart: args.weekStart,
        teenId: args.teenId,
        status: "skipped",
      });
    }
  },
});

export const resetToPending = mutation({
  args: { weekStart: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_weekStart_and_teenId", (q) =>
        q.eq("weekStart", args.weekStart).eq("teenId", args.teenId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        leaderName: undefined,
        contactedAt: undefined,
        notes: undefined,
      });
    }
  },
});

export const autoPopulate = mutation({
  args: { weekStart: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_weekStart", (q) => q.eq("weekStart", args.weekStart))
      .collect();
    const existingTeenIds = new Set(existing.map((t) => t.teenId));
    const allTeens = await ctx.db.query("teens").collect();
    let count = 0;
    for (const teen of allTeens) {
      if (!existingTeenIds.has(teen._id)) {
        await ctx.db.insert("contacts", {
          weekStart: args.weekStart,
          teenId: teen._id,
          status: "pending",
        });
        count++;
      }
    }
    return count;
  },
});
