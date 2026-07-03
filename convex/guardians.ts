import { v } from "convex/values";
import { query } from "./_generated/server";
import { canAccessTeen, requireAccess } from "./authz";

export const listByTeen = query({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const teen = await ctx.db.get(args.teenId);
    if (!teen) return { guardians: [], consents: [] };
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, teen)) throw new Error("No autorizado");
    const guardians = await ctx.db
      .query("guardians")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .collect();
    const consents = await ctx.db
      .query("consents")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .collect();
    return { guardians, consents };
  },
});
