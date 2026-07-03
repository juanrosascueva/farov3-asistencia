import { v } from "convex/values";
import { query } from "./_generated/server";
import { filterTeensByScope, requireAccess, normalizeRole } from "./authz";

const openTaskStatuses = new Set(["pending", "in_progress", "rescheduled", "escalated"]);

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
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const allTeens = await ctx.db.query("teens").collect();
    const teens = filterTeensByScope(access, allTeens);
    const teenIds = new Set(teens.map((teen) => String(teen._id)));
    const attendance = (await ctx.db.query("attendance").collect()).filter((a) => teenIds.has(String(a.teenId)));
    const tasks = (await ctx.db.query("pastoralTasks").collect()).filter((task) => teenIds.has(String(task.teenId)));
    const crisis = (await ctx.db.query("crisisAlerts").collect()).filter((alert) => teenIds.has(String(alert.teenId)));
    const groups = await ctx.db.query("group").collect();
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
    };
  },
});
