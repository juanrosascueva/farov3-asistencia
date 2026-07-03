import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

const adminRoles = new Set(["admin", "pastor", "director"]);

function toJson(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const json = JSON.stringify(value);
  return json.length > 4000 ? json.slice(0, 4000) + "...[truncated]" : json;
}

export async function logAudit(ctx: any, args: {
  token?: string | null;
  userId?: any;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  details?: string;
  ip?: string;
  userAgent?: string;
}) {
  const user = args.token ? await getUserFromToken(ctx, args.token) : null;
  const session = args.token
    ? await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", args.token)).first()
    : null;
  await ctx.db.insert("auditLog", {
    action: args.action,
    userId: args.userId ?? user?._id,
    userName: args.userName ?? user?.name,
    entityType: args.entityType,
    entityId: args.entityId,
    targetType: args.entityType,
    targetId: args.entityId,
    previousValue: toJson(args.previousValue),
    newValue: toJson(args.newValue),
    details: args.details,
    ip: args.ip ?? session?.ip,
    userAgent: args.userAgent ?? session?.userAgent,
    createdAt: new Date().toISOString(),
  });
}

export const log = mutation({
  args: {
    token: v.optional(v.string()),
    action: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await logAudit(ctx, {
      token: args.token,
      userId: args.userId,
      userName: args.userName,
      action: args.action,
      entityType: args.targetType,
      entityId: args.targetId,
      previousValue: args.previousValue,
      newValue: args.newValue,
      details: args.details,
    });
  },
});

export const logInternal = internalMutation({
  args: {
    token: v.optional(v.string()),
    action: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    details: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logAudit(ctx, args);
  },
});

export const recordExport = mutation({
  args: {
    token: v.string(),
    exportType: v.string(),
    recordCount: v.optional(v.number()),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logAudit(ctx, {
      token: args.token,
      action: "data.exported",
      entityType: "export",
      details: `${args.exportType}${args.recordCount !== undefined ? ` (${args.recordCount} registros)` : ""}${args.details ? ` - ${args.details}` : ""}`,
    });
  },
});

export const recordJournalView = mutation({
  args: { token: v.string(), teenId: v.id("teens") },
  handler: async (ctx, args) => {
    await logAudit(ctx, {
      token: args.token,
      action: "journal.viewed",
      entityType: "teen",
      entityId: String(args.teenId),
      details: "Visualizo la bitacora pastoral del adolescente.",
    });
  },
});

export const list = query({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user || !adminRoles.has(user.role)) throw new Error("No autorizado");
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(args.limit ?? 100, 300));
    return logs.filter((log) => {
      if (args.action && log.action !== args.action) return false;
      if (args.entityType && (log.entityType || log.targetType) !== args.entityType) return false;
      if (args.userId && log.userId !== args.userId) return false;
      return true;
    });
  },
});
