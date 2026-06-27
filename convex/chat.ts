import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createSession = mutation({
  handler: async (ctx) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("chatSessions", { createdAt: now, updatedAt: now });
  },
});

export const addMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: new Date().toISOString(),
    });
    await ctx.db.patch(args.sessionId, { updatedAt: new Date().toISOString() });
  },
});

export const getMessages = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const getLatestSession = query({
  handler: async (ctx) => {
    return await ctx.db.query("chatSessions").order("desc").first();
  },
});
