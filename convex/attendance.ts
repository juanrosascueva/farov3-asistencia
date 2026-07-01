import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

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

export const deleteDate = mutation({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor")) {
      throw new Error("No autorizado. Solo pastores o administradores pueden eliminar fechas de asistencia.");
    }
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    for (const r of records) {
      await ctx.db.delete(r._id);
    }
  },
});

export const updateDate = mutation({
  args: { token: v.string(), oldDate: v.string(), newDate: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "admin" && user.role !== "pastor")) {
      throw new Error("No autorizado. Solo pastores o administradores pueden editar fechas de asistencia.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.newDate)) {
      throw new Error("Formato de fecha inválido. Use AAAA-MM-DD.");
    }
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.oldDate))
      .collect();
    for (const r of records) {
      await ctx.db.patch(r._id, { date: args.newDate });
    }
  },
});
