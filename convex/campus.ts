import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    return await ctx.db.query("campus").collect();
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("campus") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado. Solo pastores y directores pueden crear sedes.");
    }
    const id = await ctx.db.insert("campus", {
      name: args.name,
      address: args.address,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("campus"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado");
    }
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.address !== undefined) patch.address = args.address;
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("campus") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || user.role !== "pastor") {
      throw new Error("No autorizado. Solo el pastor puede eliminar sedes.");
    }
    // Remove associated ministries and groups
    const ministries = await ctx.db
      .query("ministry")
      .withIndex("by_campusId", q => q.eq("campusId", args.id))
      .collect();
    for (const m of ministries) {
      const groups = await ctx.db
        .query("group")
        .withIndex("by_ministryId", q => q.eq("ministryId", m._id))
        .collect();
      for (const g of groups) {
        await ctx.db.delete(g._id);
      }
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.id);
  },
});
