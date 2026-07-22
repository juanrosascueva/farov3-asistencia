import { v } from "convex/values";
import { query } from "./_generated/server";
import { filterTeensByScope, requireAccess } from "./authz";

const optionalId = (table: "campus" | "ministry" | "group") => v.optional(v.union(v.id(table), v.literal("")));
function matches(record: any, scope: any) { if (scope.groupId) return String(record.groupId || "") === String(scope.groupId); if (scope.ministryId) return String(record.ministryId || "") === String(scope.ministryId); if (scope.campusId) return String(record.campusId || "") === String(scope.campusId); return true; }

export const getLevel2Summary = query({
  args: { token: v.string(), campusId: optionalId("campus"), ministryId: optionalId("ministry"), groupId: optionalId("group") },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "coordinador"); const scope = { campusId: args.campusId || undefined, ministryId: args.ministryId || undefined, groupId: args.groupId || undefined };
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect()).filter(t => matches(t, scope)); const ids = new Set(teens.map(t => String(t._id)));
    const attendance = (await ctx.db.query("attendance").collect()).filter(a => ids.has(String(a.teenId))); const sessions = (await ctx.db.query("meetingSessions").collect()).filter(s => matches(s, scope));
    const milestones = (await ctx.db.query("integrationMilestones").collect()).filter(m => ids.has(String(m.teenId))); const tasks = (await ctx.db.query("pastoralTasks").collect()).filter(t => ids.has(String(t.teenId)));
    const reasons: Record<string, number> = {}; attendance.filter(a => a.status === "excused" && a.excuseReason).forEach(a => reasons[a.excuseReason!] = (reasons[a.excuseReason!] || 0) + 1);
    const byType: Record<string, { sessions: number; present: number; total: number }> = {}; sessions.forEach(s => byType[s.type] ||= { sessions: 0, present: 0, total: 0 }); sessions.forEach(s => byType[s.type].sessions++); attendance.forEach(a => { const type = sessions.find(s => String(s._id) === String(a.sessionId))?.type || "culto_adolescentes"; byType[type] ||= { sessions: 0, present: 0, total: 0 }; byType[type].total++; if (a.status === "present") byType[type].present++; });
    return { attendanceByType: Object.entries(byType).map(([type, value]) => ({ type, ...value, rate: value.total ? Math.round(value.present / value.total * 100) : 0 })), milestones: { total: milestones.length, byType: milestones.reduce((out: Record<string, number>, item) => { out[item.type] = (out[item.type] || 0) + 1; return out; }, {}) }, absenceReasons: reasons, taskCompletion: { open: tasks.filter(t => ["pending", "in_progress", "rescheduled", "escalated"].includes(t.status)).length, done: tasks.filter(t => t.status === "done").length }, consentPending: teens.filter(t => !t.consentimientoDatos || !t.consentimientoFoto).length };
  },
});
