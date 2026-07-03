import { v } from "convex/values";
import { query } from "./_generated/server";
import { canAccessTeen, requireAccess } from "./authz";

export const getByTeen = query({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const teen = await ctx.db.get(args.teenId);
    if (!teen) return null;
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, teen)) throw new Error("No autorizado");
    const personId = teen.personId;
    const person = personId ? await ctx.db.get(personId) : null;
    const enrollments = personId
      ? await ctx.db
          .query("ministryEnrollments")
          .withIndex("by_personId", (q) => q.eq("personId", personId))
          .collect()
      : [];
    return { person, enrollments };
  },
});
