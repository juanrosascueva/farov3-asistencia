import { v } from "convex/values";
import { query } from "./_generated/server";
import { filterTeensByScope, requireAccess, normalizeRole } from "./authz";

const openTaskStatuses = new Set(["pending", "in_progress", "rescheduled", "escalated"]);
const optionalCampusId = v.optional(v.union(v.id("campus"), v.literal("")));
const optionalMinistryId = v.optional(v.union(v.id("ministry"), v.literal("")));
const optionalGroupId = v.optional(v.union(v.id("group"), v.literal("")));

function matchesActiveScope(record: { campusId?: any; ministryId?: any; groupId?: any }, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  if (scope.groupId) return String(record.groupId || "") === String(scope.groupId);
  if (scope.ministryId) return String(record.ministryId || "") === String(scope.ministryId);
  if (scope.campusId) return String(record.campusId || "") === String(scope.campusId);
  return true;
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.floor((b - a) / 86400000);
}

function roleVariant(role: string) {
  const normalized = normalizeRole(role);
  if (["administrador", "pastor", "director"].includes(normalized)) return "pastor";
  if (normalized === "coordinador") return "coordinador";
  return "leader";
}

export const getRoleSummary = query({
  args: { token: v.string(), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const allTeens = await ctx.db.query("teens").collect();
    const activeScope = { campusId: args.campusId || undefined, ministryId: args.ministryId || undefined, groupId: args.groupId || undefined };
    const teens = filterTeensByScope(access, allTeens).filter((teen) => matchesActiveScope(teen, activeScope));
    const teenIds = new Set(teens.map((teen) => String(teen._id)));
    const attendance = (await ctx.db.query("attendance").collect()).filter((a) => teenIds.has(String(a.teenId)));
    const tasks = (await ctx.db.query("pastoralTasks").collect()).filter((task) => teenIds.has(String(task.teenId)));
    const crisis = (await ctx.db.query("crisisAlerts").collect()).filter((alert) => teenIds.has(String(alert.teenId)));
    const groups = await ctx.db.query("group").collect();
    const userDocs = await ctx.db.query("users").collect();
    const users = new Map(userDocs.map((user) => [String(user._id), user.name]));
    const groupLeaderById = new Map(groups.map((group) => [String(group._id), group.leaderId]));
    const effectiveLeaderByTeenId = new Map(teens.map((teen) => [
      String(teen._id),
      teen.liderPrincipalId
        ? { userId: teen.liderPrincipalId, source: "individual" }
        : groupLeaderById.get(String(teen.groupId || ""))
          ? { userId: groupLeaderById.get(String(teen.groupId || "")), source: "group" }
          : { userId: undefined, source: "unassigned" },
    ]));
    const activePlans = (await ctx.db.query("pastoralPlans").collect()).filter((plan) => teenIds.has(String(plan.teenId)) && plan.status === "active");
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = monthOf(today);

    const needsContact = teens
      .map((teen) => {
        const history = attendance
          .filter((a) => String(a.teenId) === String(teen._id))
          .sort((a, b) => b.date.localeCompare(a.date));
        const reasons: string[] = [];
        const lastTwo = history.slice(0, 2);
        if (lastTwo.length === 2 && lastTwo.every((a) => a.status === "absent")) reasons.push("2 ausencias seguidas");
        const monthAbsences = history.filter((a) => monthOf(a.date) === currentMonth && a.status === "absent").length;
        if (monthAbsences >= 3) reasons.push("3 ausencias en el mes");
        const lastPresent = history.find((a) => a.status === "present");
        if (lastPresent && daysBetween(lastPresent.date, today) >= 30) reasons.push("No viene hace 30 días");
        if ((teen as any).estado === "visitante") {
          const presents = history.filter((a) => a.status === "present");
          if (presents.length === 1 && daysBetween(presents[0].date, today) >= 7) reasons.push("Visitante no volvió");
        }
        return reasons.length
          ? {
              teenId: teen._id,
              teenName: `${teen.nombre} ${teen.apellido}`.trim(),
              reasons,
              priority: reasons.some((r) => r.includes("30") || r.includes("3 ausencias")) ? "high" : "medium",
            }
          : null;
      })
      .filter(Boolean)
      .slice(0, 12);

    const needsContactByTeenId = new Set(needsContact.map((item: any) => String(item.teenId)));
    const activePlansByTeenId = new Set(activePlans.map((plan) => String(plan.teenId)));
    const groupHealth = groups
      .map((group) => {
        const groupTeens = teens.filter((teen) => String(teen.groupId || "") === String(group._id));
        if (groupTeens.length === 0) return null;
        const groupTeenIds = new Set(groupTeens.map((teen) => String(teen._id)));
        const groupAttendance = attendance.filter((a) => groupTeenIds.has(String(a.teenId)));
        const groupPresent = groupAttendance.filter((a) => a.status === "present").length;
        const groupOpenTasks = tasks.filter((task) => groupTeenIds.has(String(task.teenId)) && openTaskStatuses.has(task.status));
        const groupPendingCrisis = crisis.filter((alert) => groupTeenIds.has(String(alert.teenId)) && ["open", "in_progress", "follow_up", "unattended"].includes(alert.status));
        const contactCount = groupTeens.filter((teen) => needsContactByTeenId.has(String(teen._id))).length;
        const planCoverage = Math.round((groupTeens.filter((teen) => activePlansByTeenId.has(String(teen._id))).length / groupTeens.length) * 100);
        const attendancePct = groupAttendance.length ? Math.round((groupPresent / groupAttendance.length) * 100) : 0;
        const healthScore = Math.max(0, Math.min(100, Math.round(attendancePct * 0.45 + planCoverage * 0.25 + Math.max(0, 100 - contactCount * 15) * 0.2 + Math.max(0, 100 - groupOpenTasks.length * 8 - groupPendingCrisis.length * 20) * 0.1)));
        return {
          groupId: group._id,
          groupName: group.name,
          teens: groupTeens.length,
          attendancePct,
          planCoverage,
          openTasks: groupOpenTasks.length,
          pendingCrisis: groupPendingCrisis.length,
          needsContact: contactCount,
          healthScore,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.healthScore - b.healthScore);

    const openTasks = tasks.filter((task) => openTaskStatuses.has(task.status));
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
    const present = attendance.filter((a) => a.status === "present").length;
    const attendanceTotal = attendance.length;

    const isSupervisor = roleVariant(access.user.role) !== "leader";
    const taskView = (task: any) => {
      const teen = teens.find((item) => String(item._id) === String(task.teenId));
      return {
        taskId: task._id,
        teenId: task.teenId,
        teenName: teen ? `${teen.nombre} ${teen.apellido}`.trim() : "Adolescente",
        title: task.title,
        detail: task.description || "Tarea pastoral pendiente.",
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        assignedToUserId: task.assignedToUserId,
        assignedName: task.assignedToUserId ? users.get(String(task.assignedToUserId)) || "Sin responsable" : "Sin responsable",
      };
    };
    const myTasks = openTasks
      .filter((task) => String(task.assignedToUserId || "") === String(access.user._id))
      .map(taskView)
      .sort((a, b) => Number(Boolean(b.dueDate && b.dueDate < today)) - Number(Boolean(a.dueDate && a.dueDate < today)) || (b.priority === "critical" ? 1 : 0) - (a.priority === "critical" ? 1 : 0) || (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99"));
    const mySignals = needsContact
      .filter((signal: any) => String(effectiveLeaderByTeenId.get(String(signal.teenId))?.userId || "") === String(access.user._id))
      .filter((signal: any) => !openTasks.some((task) => String(task.teenId) === String(signal.teenId)))
      .map((signal: any) => ({ ...signal, leaderSource: effectiveLeaderByTeenId.get(String(signal.teenId))?.source || "unassigned" }));
    const unassigned = teens
      .filter((teen) => !effectiveLeaderByTeenId.get(String(teen._id))?.userId)
      .map((teen) => {
        const signal = needsContact.find((item: any) => String(item.teenId) === String(teen._id));
        return {
          teenId: teen._id,
          teenName: `${teen.nombre} ${teen.apellido}`.trim(),
          reason: signal?.reasons?.join(" · ") || "Sin líder responsable asignado.",
        };
      });
    const myAssignedTeens = teens.filter((teen) => String(effectiveLeaderByTeenId.get(String(teen._id))?.userId || "") === String(access.user._id)).length;
    const supervisionPriorities = openTasks
      .filter((task) => task.priority === "critical" || task.priority === "high" || task.status === "escalated" || (task.dueDate && task.dueDate < today))
      .map(taskView)
      .sort((a, b) => (b.priority === "critical" ? 1 : 0) - (a.priority === "critical" ? 1 : 0) || Number(Boolean(b.dueDate && b.dueDate < today)) - Number(Boolean(a.dueDate && a.dueDate < today)));
    const teamCoverage = isSupervisor ? userDocs.map((user) => {
      const assigned = teens.filter(teen => String(effectiveLeaderByTeenId.get(String(teen._id))?.userId || "") === String(user._id)).length;
      const userTasks = openTasks.filter(task => String(task.assignedToUserId || "") === String(user._id));
      if (!assigned && !userTasks.length) return null;
      return { userId: user._id, name: user.name, assigned, capacity: user.pastoralCapacity || 12, openTasks: userTasks.length, overdue: userTasks.filter(task => task.dueDate && task.dueDate < today).length };
    }).filter(Boolean) : [];

    return {
      role: access.user.role,
      variant: roleVariant(access.user.role),
      scope: {
        isGlobal: access.isGlobal,
        campusCount: access.accessibleCampusIds.length,
        ministryCount: access.accessibleMinistryIds.length,
        groupCount: access.accessibleGroupIds.length,
      },
      metrics: {
        totalTeens: teens.length,
        teamCoverage,
        activeTeens: teens.filter((t: any) => !["inactivo", "egresado", "trasladado"].includes(t.estado)).length,
        visitors: teens.filter((t: any) => t.estado === "visitante").length,
        newTeens: teens.filter((t: any) => t.estado === "nuevo" || t.nivelIntegracion === "nuevo").length,
        incompleteProfiles: teens.filter((t: any) => t.fichaCompleta === false || t.registroRapido === true).length,
        attendancePct: attendanceTotal ? Math.round((present / attendanceTotal) * 100) : 0,
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
        leadersWithTasks: new Set(openTasks.map((t) => String(t.assignedToUserId || ""))).size,
        pendingCrisis: crisis.filter((c) => ["open", "in_progress", "follow_up", "unattended"].includes(c.status)).length,
        criticalCrisis: crisis.filter((c) => c.severity === "critical" && !["attended", "referred"].includes(c.status)).length,
      },
      needsContact,
      groupHealth,
      portfolio: {
        isSupervisor,
        myTasks: myTasks.slice(0, 3),
        mySignals: mySignals.slice(0, 3),
        supervisionPriorities: supervisionPriorities.slice(0, 3),
        unassigned: unassigned.slice(0, 5),
        assignedTeens: isSupervisor ? teens.length - unassigned.length : myAssignedTeens,
        totalTeens: teens.length,
      },
    };
  },
});
