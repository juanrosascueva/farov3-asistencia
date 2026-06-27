import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getEffectiveAccess, filterTeensByScope } from "./authz";

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("teens").collect();
    if (!args.token) return all;
    const access = await getEffectiveAccess(ctx, args.token);
    if (!access) return all;
    if (access.isGlobal) return all;
    return filterTeensByScope(access, all);
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
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
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
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
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
    for (const table of ["attendance", "journal"] as const) {
      const records = await ctx.db
        .query(table)
        .withIndex("by_teenId", (q) => q.eq("teenId", args.id))
        .collect();
      for (const r of records) {
        await ctx.db.delete(r._id);
      }
    }
    await ctx.db.delete(args.id);
  },
});

export const migrateNotasToJournal = mutation({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    let migrated = 0;
    for (const teen of teens) {
      if (teen.notas && teen.notas.trim()) {
        await ctx.db.insert("journal", {
          teenId: teen._id,
          entryDate: new Date().toISOString().slice(0, 10),
          content: teen.notas.trim(),
          category: "other",
          leaderName: "Migración",
          followUp: false,
        });
        await ctx.db.patch(teen._id, { notas: "" });
        migrated++;
      }
    }
    return { migrated };
  },
});

export const removeAll = mutation({
  handler: async (ctx) => {
    const allJournal = await ctx.db.query("journal").collect();
    for (const r of allJournal) {
      await ctx.db.delete(r._id);
    }
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
