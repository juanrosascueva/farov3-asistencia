import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { canAccessTeen, filterTeensByScope, requireAccess } from "./authz";

const severity = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"));
const status = v.union(
  v.literal("open"),
  v.literal("in_progress"),
  v.literal("attended"),
  v.literal("referred"),
  v.literal("follow_up")
);
const openStatuses = new Set(["unattended", "open", "in_progress", "follow_up"]);
const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const elevatedRoles = new Set(["coordinador", "director", "pastor", "admin"]);

function mapSeverity(riskLevel?: string, suggested?: string) {
  if (suggested && ["low", "medium", "high", "critical"].includes(suggested)) return suggested as any;
  if (riskLevel === "high") return "critical";
  if (riskLevel === "medium") return "high";
  return "medium";
}

async function getAssignedLeader(ctx: any, teen: any) {
  if (!teen?.groupId) return undefined;
  const group = await ctx.db.get(teen.groupId);
  return group?.leaderId;
}

async function insertAction(ctx: any, alertId: any, actionType: any, notes: string, actorUserId?: any) {
  await ctx.db.insert("crisisActions", {
    alertId,
    actorUserId,
    actionType,
    notes,
    createdAt: new Date().toISOString(),
  });
}

async function enrichAlert(ctx: any, alert: any) {
  const teen = await ctx.db.get(alert.teenId);
  const assigned = alert.assignedToUserId ? await ctx.db.get(alert.assignedToUserId) : null;
  return {
    ...alert,
    severity: alert.severity ?? "critical",
    status: alert.status === "unattended" ? "open" : alert.status,
    teenName: teen ? `${teen.nombre} ${teen.apellido}` : "Adolescente",
    assignedName: assigned?.name || "",
  };
}

async function requireAlertAccess(ctx: any, token: string, alertId: any) {
  const access = await requireAccess(ctx, token, "helper");
  const alert = await ctx.db.get(alertId);
  if (!alert) throw new Error("Alerta no encontrada.");
  const teen = await ctx.db.get(alert.teenId);
  if (!teen) throw new Error("Adolescente no encontrado.");
  if (!canAccessTeen(access, teen)) throw new Error("No tienes acceso a esta alerta.");
  return { access, alert, teen };
}

export const createAlert = internalMutation({
  args: {
    analysisId: v.id("journalAnalysis"),
    teenId: v.id("teens"),
    summary: v.string(),
    riskLevel: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    severity: v.optional(severity),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const teen = await ctx.db.get(args.teenId);
    const assignedToUserId = await getAssignedLeader(ctx, teen);
    const alertSeverity = mapSeverity(args.riskLevel, args.severity);
    const alertId = await ctx.db.insert("crisisAlerts", {
      analysisId: args.analysisId,
      teenId: args.teenId,
      summary: args.summary,
      severity: alertSeverity,
      assignedToUserId,
      status: "open",
      createdAt: now,
      lastActionAt: now,
    });

    await insertAction(ctx, alertId, "created", `Alerta creada con severidad ${alertSeverity}.`);
    if (assignedToUserId) {
      await insertAction(ctx, alertId, "assigned", "Asignada automaticamente al lider del grupo.", assignedToUserId);
    }
    if (["medium", "high", "critical"].includes(alertSeverity)) {
      await ctx.db.insert("pastoralTasks", {
        teenId: args.teenId,
        source: "crisis",
        title: "Atender alerta de crisis pastoral",
        description: args.summary,
        assignedToUserId,
        dueDate: now.slice(0, 10),
        priority: alertSeverity,
        status: "pending",
        relatedCrisisAlertId: alertId,
        createdAt: now,
        updatedAt: now,
      });
      await insertAction(ctx, alertId, "task_created", "Tarea pastoral obligatoria creada.");
    }
    return alertId;
  },
});

export const updateStatus = mutation({
  args: {
    token: v.string(),
    alertId: v.id("crisisAlerts"),
    status,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { access, alert } = await requireAlertAccess(ctx, args.token, args.alertId);
    const notes = args.notes?.trim() || "";
    const nextStatus = args.status;
    const effectiveSeverity = alert.severity ?? "critical";
    if (["attended", "referred", "follow_up"].includes(nextStatus) && !notes) {
      throw new Error("Registra una nota de decision o seguimiento.");
    }
    if (effectiveSeverity === "critical" && ["attended", "referred"].includes(nextStatus) && !elevatedRoles.has(access.user.role)) {
      throw new Error("Solo coordinador, director, pastor o admin pueden cerrar o derivar una crisis critica.");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.alertId, {
      status: nextStatus,
      decisionNotes: notes || alert.decisionNotes,
      lastActionAt: now,
      closedAt: ["attended", "referred"].includes(nextStatus) ? now : undefined,
      attendedAt: nextStatus === "attended" ? now : alert.attendedAt,
      attendedBy: nextStatus === "attended" ? access.user.name : alert.attendedBy,
    });
    const actionType = nextStatus === "in_progress" ? "note" : nextStatus;
    await insertAction(ctx, args.alertId, actionType, notes || `Estado actualizado a ${nextStatus}.`, access.user._id);
  },
});

export const markAttended = mutation({
  args: {
    token: v.string(),
    alertId: v.id("crisisAlerts"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const { access, alert } = await requireAlertAccess(ctx, args.token, args.alertId);
    if ((alert.severity ?? "critical") === "critical" && !elevatedRoles.has(access.user.role)) {
      throw new Error("Solo coordinador, director, pastor o admin pueden cerrar una crisis critica.");
    }
    const now = new Date().toISOString();
    await ctx.db.patch(args.alertId, {
      status: "attended",
      decisionNotes: args.notes.trim(),
      lastActionAt: now,
      closedAt: now,
      attendedAt: now,
      attendedBy: access.user.name,
    });
    await insertAction(ctx, args.alertId, "attended", args.notes.trim(), access.user._id);
  },
});

export const getUnattendedAlerts = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const alerts = (await ctx.db.query("crisisAlerts").order("desc").collect())
      .filter((alert) => openStatuses.has(alert.status));
    if (!args.token) return await Promise.all(alerts.map((alert) => enrichAlert(ctx, alert)));
    const access = await requireAccess(ctx, args.token, "helper");
    const allowedTeenIds = new Set(filterTeensByScope(access, await ctx.db.query("teens").collect()).map((teen) => teen._id));
    const scoped = alerts.filter((alert) => allowedTeenIds.has(alert.teenId));
    const enriched = await Promise.all(scoped.map((alert) => enrichAlert(ctx, alert)));
    return enriched.sort((a, b) => {
      const severityDelta = severityRank[b.severity] - severityRank[a.severity];
      if (severityDelta) return severityDelta;
      return (b.lastActionAt || b.createdAt).localeCompare(a.lastActionAt || a.createdAt);
    });
  },
});

export const getAllAlerts = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const alerts = await ctx.db.query("crisisAlerts").order("desc").collect();
    if (!args.token) return await Promise.all(alerts.map((alert) => enrichAlert(ctx, alert)));
    const access = await requireAccess(ctx, args.token, "helper");
    const allowedTeenIds = new Set(filterTeensByScope(access, await ctx.db.query("teens").collect()).map((teen) => teen._id));
    return await Promise.all(alerts.filter((alert) => allowedTeenIds.has(alert.teenId)).map((alert) => enrichAlert(ctx, alert)));
  },
});

export const getAlertsByTeen = query({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.token) {
      const access = await requireAccess(ctx, args.token, "helper");
      const teen = await ctx.db.get(args.teenId);
      if (!teen || !canAccessTeen(access, teen)) throw new Error("No tienes acceso a este adolescente.");
    }
    const alerts = await ctx.db
      .query("crisisAlerts")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
    return await Promise.all(alerts.map((alert) => enrichAlert(ctx, alert)));
  },
});

export const listActions = query({
  args: { token: v.string(), alertId: v.id("crisisAlerts") },
  handler: async (ctx, args) => {
    await requireAlertAccess(ctx, args.token, args.alertId);
    return await ctx.db
      .query("crisisActions")
      .withIndex("by_alertId", (q) => q.eq("alertId", args.alertId))
      .collect();
  },
});
