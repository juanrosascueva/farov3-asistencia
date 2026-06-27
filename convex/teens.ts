import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("teens").collect();
  },
});

export const get = query({
  args: { id: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    nombre: v.string(),
    apellido: v.string(),
    nacimiento: v.string(),
    telefono: v.string(),
    telefonoPadre: v.string(),
    gustos: v.string(),
    notas: v.string(),
    foto: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("teens", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("teens"),
    nombre: v.optional(v.string()),
    apellido: v.optional(v.string()),
    nacimiento: v.optional(v.string()),
    telefono: v.optional(v.string()),
    telefonoPadre: v.optional(v.string()),
    gustos: v.optional(v.string()),
    notas: v.optional(v.string()),
    foto: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const cleaned = Object.fromEntries(
      Object.entries(fields).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, cleaned);
  },
});

export const remove = mutation({
  args: { id: v.id("teens") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.id))
      .collect();
    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const removeAll = mutation({
  handler: async (ctx) => {
    const allAttendance = await ctx.db.query("attendance").collect();
    for (const r of allAttendance) {
      await ctx.db.delete(r._id);
    }
    const allTeens = await ctx.db.query("teens").collect();
    for (const t of allTeens) {
      await ctx.db.delete(t._id);
    }
  },
});
