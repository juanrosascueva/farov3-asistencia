import { v } from "convex/values";
import { query } from "./_generated/server";
import { filterTeensByScope, requireAccess } from "./authz";

const optionalCampusId = v.optional(v.union(v.id("campus"), v.literal("")));
const optionalMinistryId = v.optional(v.union(v.id("ministry"), v.literal("")));
const optionalGroupId = v.optional(v.union(v.id("group"), v.literal("")));
const openStatuses = new Set(["pending", "in_progress", "rescheduled", "escalated"]);
const priorityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function matchesScope(record: { campusId?: any; ministryId?: any; groupId?: any }, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  if (scope.groupId) return String(record.groupId || "") === String(scope.groupId);
  if (scope.ministryId) return String(record.ministryId || "") === String(scope.ministryId);
  if (scope.campusId) return String(record.campusId || "") === String(scope.campusId);
  return true;
}

function daysBetween(from: string, to: string) {
  return Math.floor((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
}

export const getQueue = query({
  args: { token: v.string(), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const scope = { campusId: args.campusId || undefined, ministryId: args.ministryId || undefined, groupId: args.groupId || undefined };
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect()).filter((teen) => matchesScope(teen, scope));
    const teenIds = new Set(teens.map((teen) => String(teen._id)));
    const teenById = new Map(teens.map((teen) => [String(teen._id), teen]));
    const today = new Date().toISOString().slice(0, 10);
    const tasks = (await ctx.db.query("pastoralTasks").collect()).filter((task) => teenIds.has(String(task.teenId)) && openStatuses.has(task.status));
    const taskTeenIds = new Set(tasks.map((task) => String(task.teenId)));
    const users = new Map((await ctx.db.query("users").collect()).map((user) => [String(user._id), user.name]));

    const taskItems = tasks.map((task) => {
      const teen = teenById.get(String(task.teenId));
      return {
        kind: "task" as const,
        id: String(task._id),
        taskId: task._id,
        teenId: task.teenId,
        teenName: teen ? `${teen.nombre} ${teen.apellido}`.trim() : "Adolescente",
        title: task.title,
        detail: task.description || "Tarea pastoral pendiente.",
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        assignedToUserId: task.assignedToUserId,
        assignedName: task.assignedToUserId ? users.get(String(task.assignedToUserId)) || "Sin responsable" : "Sin responsable",
        source: task.source,
        crisisAlertId: task.relatedCrisisAlertId,
      };
    });

    const attendance = (await ctx.db.query("attendance").collect()).filter((record) => teenIds.has(String(record.teenId)));
    const signalItems = teens.flatMap((teen) => {
      if (taskTeenIds.has(String(teen._id))) return [];
      const history = attendance.filter((record) => String(record.teenId) === String(teen._id)).sort((a, b) => b.date.localeCompare(a.date));
      const recent = history.slice(0, 2);
      const reasons: string[] = [];
      if (recent.length === 2 && recent.every((record) => record.status === "absent")) reasons.push("2 ausencias seguidas");
      const monthlyAbsences = history.filter((record) => record.date.slice(0, 7) === today.slice(0, 7) && record.status === "absent").length;
      if (monthlyAbsences >= 3) reasons.push("3 ausencias en el mes");
      const lastPresent = history.find((record) => record.status === "present");
      if (lastPresent && daysBetween(lastPresent.date, today) >= 30) reasons.push("No viene hace 30 días");
      if (!reasons.length) return [];
      return [{
        kind: "signal" as const,
        id: `signal:${teen._id}`,
        teenId: teen._id,
        teenName: `${teen.nombre} ${teen.apellido}`.trim(),
        title: "Señal de asistencia por revisar",
        detail: reasons.join(" · "),
        priority: reasons.some((reason) => reason.includes("30") || reason.includes("3 ausencias")) ? "high" : "medium",
        status: "signal",
        suggestedTaskTitle: `Dar seguimiento: ${reasons[0]}`,
      }];
    });

    const crisisItems = (await ctx.db.query("crisisAlerts").collect())
      .filter((alert) => teenIds.has(String(alert.teenId)) && ["open", "in_progress", "follow_up", "unattended"].includes(alert.status) && !tasks.some((task) => String(task.relatedCrisisAlertId || "") === String(alert._id)))
      .map((alert) => {
        const teen = teenById.get(String(alert.teenId));
        return {
          kind: "crisis" as const,
          id: `crisis:${alert._id}`,
          crisisAlertId: alert._id,
          teenId: alert.teenId,
          teenName: teen ? `${teen.nombre} ${teen.apellido}`.trim() : "Adolescente",
          title: "Alerta pastoral sin tarea",
          detail: alert.summary,
          priority: alert.severity || "high",
          status: alert.status,
          suggestedTaskTitle: "Atender alerta pastoral",
        };
      });

    return [...taskItems, ...crisisItems, ...signalItems].sort((a, b) => {
      const priorityDelta = priorityRank[b.priority] - priorityRank[a.priority];
      if (priorityDelta) return priorityDelta;
      const aDue = a.kind === "task" && a.dueDate && a.dueDate < today ? 1 : 0;
      const bDue = b.kind === "task" && b.dueDate && b.dueDate < today ? 1 : 0;
      return bDue - aDue;
    });
  },
});
