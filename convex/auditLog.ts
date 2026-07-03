import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

const adminRoles = new Set(["admin", "pastor", "director"]);
const contactFields = new Set([
  "telefono",
  "telefonoPadre",
  "telefonoSecundario",
  "contactoEmergenciaTelefono",
  "email",
  "direccion",
  "barrio",
]);
const pastoralFields = new Set([
  "notas",
  "observacionInicial",
  "content",
  "followUpResult",
  "decisionNotes",
  "summary",
  "reasoningSummary",
  "suggestedActions",
]);

function toJson(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const json = JSON.stringify(value);
  return json.length > 4000 ? json.slice(0, 4000) + "...[truncated]" : json;
}

function shallowChangedFields(previousValue: any, newValue: any): string[] {
  if (!previousValue || !newValue || typeof previousValue !== "object" || typeof newValue !== "object") return [];
  const keys = new Set([...Object.keys(previousValue), ...Object.keys(newValue)]);
  return [...keys].filter((key) => JSON.stringify(previousValue[key]) !== JSON.stringify(newValue[key]));
}

function classifySensitivity(entityType: string, action: string, fields: string[], newValue: any): "basic" | "contact" | "pastoral" | "sensitive" {
  if (["crisisAlert", "journalAnalysis"].includes(entityType) || action.startsWith("crisis.") || action.startsWith("ai.")) return "sensitive";
  if (entityType === "journal") return newValue?.isConfidential ? "sensitive" : "pastoral";
  if (["user", "userScope", "customRole"].includes(entityType) || action.includes("permission") || action.includes("role")) return "sensitive";
  if (fields.some((field) => pastoralFields.has(field))) return "pastoral";
  if (fields.some((field) => contactFields.has(field))) return "contact";
  return "basic";
}

function redact(value: unknown, level: "basic" | "contact" | "pastoral" | "sensitive", fields: string[]) {
  if (value === undefined) return undefined;
  if (level === "basic") return value;
  if (level === "contact" && value && typeof value === "object") {
    const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const field of contactFields) if (field in copy) copy[field] = "[redacted]";
    return copy;
  }
  return { redacted: true, sensitivityLevel: level, changedFields: fields };
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
  changedFields?: string[];
  sensitivityLevel?: "basic" | "contact" | "pastoral" | "sensitive";
  details?: string;
  ip?: string;
  userAgent?: string;
}) {
  const user = args.token ? await getUserFromToken(ctx, args.token) : null;
  const session = args.token
    ? await ctx.db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", args.token)).first()
    : null;
  const changedFields = args.changedFields ?? shallowChangedFields(args.previousValue, args.newValue);
  const sensitivityLevel = args.sensitivityLevel ?? classifySensitivity(args.entityType, args.action, changedFields, args.newValue);
  const redactedPrevious = redact(args.previousValue, sensitivityLevel, changedFields);
  const redactedNew = redact(args.newValue, sensitivityLevel, changedFields);
  await ctx.db.insert("auditLog", {
    action: args.action,
    userId: args.userId ?? user?._id,
    userName: args.userName ?? user?.name,
    entityType: args.entityType,
    entityId: args.entityId,
    targetType: args.entityType,
    targetId: args.entityId,
    previousValue: toJson(redactedPrevious),
    newValue: toJson(redactedNew),
    changedFields,
    sensitivityLevel,
    redactedPreviousValue: toJson(redactedPrevious),
    redactedNewValue: toJson(redactedNew),
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
    changedFields: v.optional(v.array(v.string())),
    sensitivityLevel: v.optional(v.union(v.literal("basic"), v.literal("contact"), v.literal("pastoral"), v.literal("sensitive"))),
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
      changedFields: args.changedFields,
      sensitivityLevel: args.sensitivityLevel,
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
    changedFields: v.optional(v.array(v.string())),
    sensitivityLevel: v.optional(v.union(v.literal("basic"), v.literal("contact"), v.literal("pastoral"), v.literal("sensitive"))),
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
    const confidentialEntries = await ctx.db
      .query("journal")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .filter((q) => q.eq(q.field("isConfidential"), true))
      .take(1);
    if (confidentialEntries.length === 0) return;
    await logAudit(ctx, {
      token: args.token,
      action: "journal.viewed",
      entityType: "teen",
      entityId: String(args.teenId),
      sensitivityLevel: "sensitive",
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
