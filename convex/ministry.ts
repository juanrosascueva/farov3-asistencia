import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const list = query({
  args: { token: v.string(), campusId: v.id("campus") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    return await ctx.db
      .query("ministry")
      .withIndex("by_campusId", q => q.eq("campusId", args.campusId))
      .collect();
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("ministry") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    campusId: v.id("campus"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado");
    }
    const id = await ctx.db.insert("ministry", {
      campusId: args.campusId,
      name: args.name,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("ministry"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado");
    }
    if (args.name !== undefined) {
      await ctx.db.patch(args.id, { name: args.name });
    }
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("ministry") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado");
    }
    // Remove associated groups
    const groups = await ctx.db
      .query("group")
      .withIndex("by_ministryId", q => q.eq("ministryId", args.id))
      .collect();
    for (const g of groups) {
      await ctx.db.delete(g._id);
    }
    await ctx.db.delete(args.id);
  },
});
