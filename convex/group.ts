import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const list = query({
  args: { token: v.string(), ministryId: v.id("ministry") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    return await ctx.db
      .query("group")
      .withIndex("by_ministryId", q => q.eq("ministryId", args.ministryId))
      .collect();
  },
});

export const get = query({
  args: { token: v.string(), id: v.id("group") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autenticado");
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.string(),
    ministryId: v.id("ministry"),
    name: v.string(),
    leaderId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director" && user.role !== "coordinador")) {
      throw new Error("No autorizado");
    }
    const id = await ctx.db.insert("group", {
      ministryId: args.ministryId,
      name: args.name,
      leaderId: args.leaderId,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("group"),
    name: v.optional(v.string()),
    leaderId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director" && user.role !== "coordinador")) {
      throw new Error("No autorizado");
    }
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.leaderId !== undefined) patch.leaderId = args.leaderId;
    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.id("group") },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || (user.role !== "pastor" && user.role !== "director")) {
      throw new Error("No autorizado");
    }
    await ctx.db.delete(args.id);
  },
});
