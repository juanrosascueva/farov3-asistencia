import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserFromToken } from "./authHelper";
import { logAudit } from "./auditLog";
import { filterTeensByScope, requireAccess } from "./authz";

const optionalCampusId = v.optional(v.union(v.id("campus"), v.literal("")));
const optionalMinistryId = v.optional(v.union(v.id("ministry"), v.literal("")));
const optionalGroupId = v.optional(v.union(v.id("group"), v.literal("")));

function matchesActiveScope(record: { campusId?: any; ministryId?: any; groupId?: any }, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  if (scope.groupId) return String(record.groupId || "") === String(scope.groupId);
  if (scope.ministryId) return String(record.ministryId || "") === String(scope.ministryId);
  if (scope.campusId) return String(record.campusId || "") === String(scope.campusId);
  return true;
}

function canViewSensitivePastoral(user: any): boolean {
  return Boolean(
    user &&
      (["admin", "administrador", "pastor", "director", "coordinador"].includes(user.role) ||
        user.permissions?.includes("view_sensitive_pastoral"))
  );
}

export const list = query({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("journal")
      .withIndex("by_teenId_and_date", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
    // Filter out confidential entries for unauthorized users
    if (!args.token) return entries.filter(e => !e.isConfidential);
    const user = await getUserFromToken(ctx, args.token);
    if (!canViewSensitivePastoral(user)) {
      return entries.filter(e => !e.isConfidential);
    }
    return entries;
  },
});

export const create = mutation({
  args: {
    teenId: v.id("teens"),
    entryDate: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("call"),
      v.literal("visit"),
      v.literal("chat"),
      v.literal("counseling"),
      v.literal("prayer"),
      v.literal("other")
    ),
    leaderName: v.string(),
    followUp: v.boolean(),
    isConfidential: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { token, ...entry } = args;
    const id = await ctx.db.insert("journal", entry);
    await logAudit(ctx, {
      token,
      action: "journal.created",
      entityType: "journal",
      entityId: String(id),
      newValue: {
        teenId: entry.teenId,
        entryDate: entry.entryDate,
        category: entry.category,
        followUp: entry.followUp,
        isConfidential: entry.isConfidential === true,
      },
      details: "Entrada de bitacora pastoral creada.",
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("journal"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    await ctx.db.delete(args.id);
    if (current) {
      await logAudit(ctx, {
        token: args.token,
        action: "journal.deleted",
        entityType: "journal",
        entityId: String(args.id),
        previousValue: {
          teenId: current.teenId,
          entryDate: current.entryDate,
          category: current.category,
          followUp: current.followUp,
          isConfidential: current.isConfidential === true,
        },
        details: "Entrada de bitacora pastoral eliminada.",
      });
    }
  },
});

export const listAll = query({
  args: { token: v.string(), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const scope = { campusId: args.campusId || undefined, ministryId: args.ministryId || undefined, groupId: args.groupId || undefined };
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect()).filter((teen) => matchesActiveScope(teen, scope));
    const teenIds = new Set(teens.map((teen) => String(teen._id)));
    const entries = await ctx.db.query("journal").order("desc").collect();
    return entries.filter((entry) => teenIds.has(String(entry.teenId)) && (!entry.isConfidential || canViewSensitivePastoral(access.user)));
  },
});

export const listFollowUps = query({
  args: { token: v.string(), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const scope = { campusId: args.campusId || undefined, ministryId: args.ministryId || undefined, groupId: args.groupId || undefined };
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect()).filter((teen) => matchesActiveScope(teen, scope));
    const teenIds = new Set(teens.map((teen) => String(teen._id)));
    const entries = await ctx.db
      .query("journal")
      .withIndex("by_followUp", (q) => q.eq("followUp", true))
      .order("desc")
      .collect();
    return entries.filter((entry) => teenIds.has(String(entry.teenId)) && (!entry.isConfidential || canViewSensitivePastoral(access.user)));
  },
});
