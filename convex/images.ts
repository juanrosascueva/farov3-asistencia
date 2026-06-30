import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester) {
      throw new Error("No autorizado");
    }
    return await ctx.storage.generateUploadUrl();
  },
});
