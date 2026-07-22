import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessTeen, filterTeensByScope, getEffectiveAccess, requireAccess } from "./authz";
import { logAudit } from "./auditLog";

const attendanceStatus = v.union(v.literal("present"), v.literal("absent"), v.literal("excused"));
const meetingType = v.union(
  v.literal("culto_adolescentes"),
  v.literal("celula"),
  v.literal("discipulado"),
  v.literal("ensayo"),
  v.literal("evento_especial"),
  v.literal("campamento")
);
const checkInMethod = v.union(v.literal("manual"), v.literal("mobile"), v.literal("qr"));
const optionalCampusId = v.optional(v.union(v.id("campus"), v.literal("")));
const optionalMinistryId = v.optional(v.union(v.id("ministry"), v.literal("")));
const optionalGroupId = v.optional(v.union(v.id("group"), v.literal("")));

function cleanOptionalId(value: string | undefined): string | undefined {
  return value || undefined;
}

function cleanText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim().replace(/\s+/g, " ");
}

function newCheckInToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function canAccessScope(access: any, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  if (access.isGlobal) return true;
  if (scope.groupId) return access.accessibleGroupIds.includes(String(scope.groupId));
  if (scope.ministryId) return access.accessibleMinistryIds.includes(String(scope.ministryId));
  if (scope.campusId) return access.accessibleCampusIds.includes(String(scope.campusId));
  return false;
}

function matchesActiveScope(record: { campusId?: any; ministryId?: any; groupId?: any }, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  if (scope.groupId) return String(record.groupId || "") === String(scope.groupId);
  if (scope.ministryId) return String(record.ministryId || "") === String(scope.ministryId);
  if (scope.campusId) return String(record.campusId || "") === String(scope.campusId);
  return true;
}

async function getSessionRoster(ctx: any, access: any, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  const teens = await ctx.db.query("teens").collect();
  return ((access.isGlobal ? teens : filterTeensByScope(access, teens)) as any[])
    .filter((teen: any) => matchesActiveScope(teen, scope));
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.floor((b - a) / 86400000);
}

export const list = query({
  args: { token: v.optional(v.string()), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("attendance").collect();
    if (!args.token) return [];
    const access = await getEffectiveAccess(ctx, args.token);
    if (!access) return [];
    const teens = await ctx.db.query("teens").collect();
    const authorizedTeens = access.isGlobal ? teens : filterTeensByScope(access, teens);
    const activeScope = {
      campusId: cleanOptionalId(args.campusId),
      ministryId: cleanOptionalId(args.ministryId),
      groupId: cleanOptionalId(args.groupId),
    };
    const allowedIds = new Set(authorizedTeens.filter((teen) => matchesActiveScope(teen, activeScope)).map((t) => String(t._id)));
    return all.filter((r) => allowedIds.has(String(r.teenId)));
  },
});

export const listSessions = query({
  args: { token: v.optional(v.string()), date: v.optional(v.string()), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const sessions = args.date
      ? await ctx.db.query("meetingSessions").withIndex("by_date", (q) => q.eq("date", args.date!)).collect()
      : await ctx.db.query("meetingSessions").collect();
    if (!args.token) return [];
    const access = await getEffectiveAccess(ctx, args.token);
    if (!access) return [];
    const authorizedSessions = access.isGlobal ? sessions : sessions.filter((session) => canAccessScope(access, session));
    const activeScope = {
      campusId: cleanOptionalId(args.campusId),
      ministryId: cleanOptionalId(args.ministryId),
      groupId: cleanOptionalId(args.groupId),
    };
    return authorizedSessions.filter((session) => matchesActiveScope(session, activeScope));
  },
});

export const createSession = mutation({
  args: {
    token: v.string(),
    date: v.string(),
    type: meetingType,
    campusId: optionalCampusId,
    ministryId: optionalMinistryId,
    groupId: optionalGroupId,
    title: v.optional(v.string()),
    objective: v.optional(v.string()),
    expectedAttendance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Formato de fecha inválido.");
    const access = await requireAccess(ctx, args.token, "helper");
    const payload = {
      date: args.date,
      type: args.type,
      campusId: cleanOptionalId(args.campusId) as any,
      ministryId: cleanOptionalId(args.ministryId) as any,
      groupId: cleanOptionalId(args.groupId) as any,
      title: cleanText(args.title),
      objective: cleanText(args.objective),
      expectedAttendance: args.expectedAttendance,
    };
    if (!canAccessScope(access, payload)) throw new Error("No tienes permisos para crear sesiones en este ámbito.");
    const id = await ctx.db.insert("meetingSessions", {
      ...payload,
      checkInToken: newCheckInToken(),
      checkInEnabled: true,
      status: "planned" as const,
      createdBy: access.user._id,
      createdAt: new Date().toISOString(),
    });
    await logAudit(ctx, {
      token: args.token,
      action: "attendance.session_created",
      entityType: "meetingSession",
      entityId: String(id),
      newValue: payload,
      details: `${payload.date} ${payload.type}`,
    });
    return id;
  },
});

export const completeSession = mutation({
  args: { token: v.string(), sessionId: v.id("meetingSessions"), resultNotes: v.optional(v.string()), allowIncomplete: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper"); const session = await ctx.db.get(args.sessionId);
    if (!session || !canAccessScope(access, session)) throw new Error("No tienes acceso a esta sesión.");
    const records = await ctx.db.query("attendance").withIndex("by_sessionId", q => q.eq("sessionId", session._id)).collect();
    const roster = await getSessionRoster(ctx, access, session);
    const markedIds = new Set(records.map((record) => String(record.teenId)));
    const pendingTeens = roster.filter((teen: any) => !markedIds.has(String(teen._id)));
    if (pendingTeens.length && !args.allowIncomplete) throw new Error("Hay adolescentes sin marcar. Revisa la lista o confirma el cierre incompleto.");
    const now = new Date().toISOString();
    const completionState = pendingTeens.length ? "incomplete" as const : "complete" as const;
    await ctx.db.patch(session._id, { status: "completed", completionState, unmarkedCount: pendingTeens.length, resultNotes: cleanText(args.resultNotes), completedAt: now });
    await logAudit(ctx, { token: args.token, action: "attendance.session_completed", entityType: "meetingSession", entityId: String(session._id), newValue: { status: "completed", completionState, unmarkedCount: pendingTeens.length, attendance: records.length }, details: args.resultNotes });
    return { present: records.filter(r => r.status === "present").length, absent: records.filter(r => r.status === "absent").length, excused: records.filter(r => r.status === "excused").length, unmarked: pendingTeens.length, completionState };
  },
});

export const getSessionSummary = query({
  args: { token: v.string(), date: v.string(), sessionId: v.optional(v.id("meetingSessions")), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const session = args.sessionId ? await ctx.db.get(args.sessionId) : null;
    if (args.sessionId && (!session || !canAccessScope(access, session))) throw new Error("No tienes acceso a esta sesión.");
    const scope = session || { campusId: cleanOptionalId(args.campusId), ministryId: cleanOptionalId(args.ministryId), groupId: cleanOptionalId(args.groupId) };
    const roster = await getSessionRoster(ctx, access, scope);
    const records = session
      ? await ctx.db.query("attendance").withIndex("by_sessionId", (q) => q.eq("sessionId", session._id)).collect()
      : (await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.date)).collect()).filter((record) => !record.sessionId);
    const allowedIds = new Set(roster.map((teen: any) => String(teen._id)));
    const scopedRecords = records.filter((record) => allowedIds.has(String(record.teenId)));
    const markedIds = new Set(scopedRecords.map((record) => String(record.teenId)));
    const pendingTeens = roster.filter((teen: any) => !markedIds.has(String(teen._id))).map((teen: any) => ({ _id: teen._id, name: `${teen.nombre} ${teen.apellido}`.trim() }));
    return {
      records: scopedRecords,
      total: roster.length,
      pendingTeens,
      counts: {
        present: scopedRecords.filter((record) => record.status === "present").length,
        absent: scopedRecords.filter((record) => record.status === "absent").length,
        excused: scopedRecords.filter((record) => record.status === "excused").length,
        marked: scopedRecords.length,
      },
      completionState: session?.completionState,
      unmarkedCount: session?.unmarkedCount,
    };
  },
});

export const retentionSummary = query({
  args: { token: v.string(), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await getEffectiveAccess(ctx, args.token); if (!access) return { seven: 0, thirty: 0, ninety: 0, visitors: 0 };
    const scope = { campusId: cleanOptionalId(args.campusId), ministryId: cleanOptionalId(args.ministryId), groupId: cleanOptionalId(args.groupId) };
    const teens = (await ctx.db.query("teens").collect()).filter(t => (access.isGlobal || canAccessTeen(access, t)) && matchesActiveScope(t, scope) && (t.estado === "visitante" || t.estado === "nuevo"));
    const attendance = await ctx.db.query("attendance").collect(); const today = new Date().toISOString().slice(0, 10);
    const retained = (days: number) => teens.filter(teen => { const history = attendance.filter(r => r.teenId === teen._id && r.status === "present").sort((a,b)=>a.date.localeCompare(b.date)); return history.length > 1 && daysBetween(history[0].date, today) >= days && history.some(r => daysBetween(history[0].date, r.date) >= days); }).length;
    return { visitors: teens.length, seven: retained(7), thirty: retained(30), ninety: retained(90) };
  },
});

export const qrCheckIn = mutation({
  args: {
    sessionId: v.id("meetingSessions"),
    token: v.string(),
    teenId: v.id("teens"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.checkInEnabled || session.checkInToken !== args.token) {
      throw new Error("Check-in no disponible para esta sesión.");
    }
    const teen = await ctx.db.get(args.teenId);
    if (!teen) throw new Error("Adolescente no encontrado.");
    if (session.groupId && String(teen.groupId || "") !== String(session.groupId)) {
      throw new Error("La ficha no pertenece al grupo de esta sesión.");
    }
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_session_and_teen", (q) => q.eq("sessionId", args.sessionId).eq("teenId", args.teenId))
      .first();
    const patch = {
      sessionId: args.sessionId,
      date: session.date,
      teenId: args.teenId,
      status: "present" as const,
      checkInMethod: "qr" as const,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("attendance", patch);
  },
});

export const getByDate = query({
  args: { date: v.string(), sessionId: v.optional(v.id("meetingSessions")) },
  handler: async (ctx, args) => {
    if (args.sessionId) {
      return await ctx.db
        .query("attendance")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
        .collect();
    }
    return await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
  },
});

export const getByTeen = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db.query("attendance").withIndex("by_teenId", (q) => q.eq("teenId", args.teenId)).collect();
  },
});

export const mark = mutation({
  args: {
    token: v.optional(v.string()),
    sessionId: v.optional(v.id("meetingSessions")),
    date: v.string(),
    teenId: v.id("teens"),
    status: attendanceStatus,
    excuseReason: v.optional(v.string()),
    absenceComment: v.optional(v.string()),
    checkInMethod: v.optional(checkInMethod),
  },
  handler: async (ctx, args) => {
    const teen = await ctx.db.get(args.teenId);
    if (!teen) throw new Error("Adolescente no encontrado.");
    if (args.token) {
      const access = await requireAccess(ctx, args.token, "helper");
      if (!canAccessTeen(access, teen)) throw new Error("No tienes permisos para marcar asistencia de este adolescente.");
    }
    const existing = args.sessionId
      ? await ctx.db
          .query("attendance")
          .withIndex("by_session_and_teen", (q) => q.eq("sessionId", args.sessionId).eq("teenId", args.teenId))
          .first()
      : await ctx.db
          .query("attendance")
          .withIndex("by_date_and_teen", (q) => q.eq("date", args.date).eq("teenId", args.teenId))
          .first();
    const patch = {
      sessionId: args.sessionId,
      date: args.date,
      teenId: args.teenId,
      status: args.status,
      excuseReason: cleanText(args.excuseReason),
      absenceComment: cleanText(args.absenceComment),
      checkInMethod: args.checkInMethod ?? "manual",
    };
    if (existing) {
      if (existing.status === args.status && !args.excuseReason && !args.absenceComment && !args.sessionId) {
        await ctx.db.delete(existing._id);
        return null;
      }
      await ctx.db.patch(existing._id, patch);
      await logAudit(ctx, {
        token: args.token,
        action: "attendance.updated",
        entityType: "attendance",
        entityId: String(existing._id),
        previousValue: existing,
        newValue: patch,
        details: `${teen.nombre} ${teen.apellido} - ${args.date}`,
      });
      return existing._id;
    }
    const id = await ctx.db.insert("attendance", patch);
    await logAudit(ctx, {
      token: args.token,
      action: "attendance.marked",
      entityType: "attendance",
      entityId: String(id),
      newValue: patch,
      details: `${teen.nombre} ${teen.apellido} - ${args.date}`,
    });
    return id;
  },
});

export const getNeedsContact = query({
  args: { token: v.optional(v.string()), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    if (!args.token) return [];
    const access = await getEffectiveAccess(ctx, args.token);
    if (!access) return [];
    const allTeens = await ctx.db.query("teens").collect();
    const authorizedTeens = access.isGlobal ? allTeens : filterTeensByScope(access, allTeens);
    const activeScope = {
      campusId: cleanOptionalId(args.campusId),
      ministryId: cleanOptionalId(args.ministryId),
      groupId: cleanOptionalId(args.groupId),
    };
    const teens = authorizedTeens.filter((teen) => matchesActiveScope(teen, activeScope));
    const allowedIds = new Set(teens.map((t) => String(t._id)));
    const allAttendance = (await ctx.db.query("attendance").collect()).filter((a) => allowedIds.has(String(a.teenId)));
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = monthOf(today);

    return teens
      .map((teen) => {
        const history = allAttendance
          .filter((a) => String(a.teenId) === String(teen._id))
          .sort((a, b) => b.date.localeCompare(a.date));
        const reasons: string[] = [];
        const recent = history.slice(0, 2);
        if (recent.length === 2 && recent.every((a) => a.status === "absent")) reasons.push("2 ausencias seguidas");
        const monthAbsences = history.filter((a) => monthOf(a.date) === currentMonth && a.status === "absent").length;
        if (monthAbsences >= 3) reasons.push("3 ausencias en el mes");
        const lastPresent = history.find((a) => a.status === "present");
        if (lastPresent && daysBetween(lastPresent.date, today) >= 30) reasons.push("No viene hace 30 días");
        if ((teen as any).estado === "visitante") {
          const presents = history.filter((a) => a.status === "present");
          if (presents.length === 1 && daysBetween(presents[0].date, today) >= 7) reasons.push("Visitante no volvió");
        }
        if (reasons.length === 0) return null;
        return {
          teenId: teen._id,
          teenName: `${teen.nombre} ${teen.apellido}`.trim(),
          groupId: teen.groupId,
          reasons,
          priority: reasons.some((r) => r.includes("30") || r.includes("3 ausencias")) ? "high" : "medium",
          lastAttendanceDate: history[0]?.date,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
  },
});

export const deleteDate = mutation({
  args: { token: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    await requireAccess(ctx, args.token, "pastor");
    const records = await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.date)).collect();
    for (const r of records) await ctx.db.delete(r._id);
    await logAudit(ctx, {
      token: args.token,
      action: "attendance.date_deleted",
      entityType: "attendance",
      previousValue: { date: args.date, count: records.length },
      details: `Fecha eliminada: ${args.date}`,
    });
  },
});

export const updateDate = mutation({
  args: { token: v.string(), oldDate: v.string(), newDate: v.string() },
  handler: async (ctx, args) => {
    await requireAccess(ctx, args.token, "pastor");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.newDate)) throw new Error("Formato de fecha inválido. Use AAAA-MM-DD.");
    const records = await ctx.db.query("attendance").withIndex("by_date", (q) => q.eq("date", args.oldDate)).collect();
    for (const r of records) await ctx.db.patch(r._id, { date: args.newDate });
    await logAudit(ctx, {
      token: args.token,
      action: "attendance.date_updated",
      entityType: "attendance",
      previousValue: { date: args.oldDate },
      newValue: { date: args.newDate, count: records.length },
      details: `Fecha editada: ${args.oldDate} -> ${args.newDate}`,
    });
  },
});
