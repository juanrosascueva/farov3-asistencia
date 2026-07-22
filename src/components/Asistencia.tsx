import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, AttendanceStatus, MeetingType } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";
import {
  fmtDate,
  fmtDateShort,
  todayISO,
  lastNSundays,
  statsFor,
  getGamification,
  streakTier,
} from "../lib/utils";
import { Avatar } from "./Layout";
import Modal from "./Modal";
import CelebrationToast from "./CelebrationToast";

interface AsistenciaProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

const MEETING_LABELS: Record<MeetingType, string> = {
  culto_adolescentes: "Culto de adolescentes",
  celula: "Célula",
  discipulado: "Discipulado",
  ensayo: "Ensayo",
  evento_especial: "Evento especial",
  campamento: "Campamento",
};

export default function Asistencia({
  teens,
  attendanceMap,
  onOpenProfile,
}: AsistenciaProps) {
  const allDates = Object.keys(attendanceMap).sort();
  const markAtt = useMutation(api.attendance.mark);
  const createSession = useMutation(api.attendance.createSession);
  const completeSession = useMutation(api.attendance.completeSession);
  const createPastoralTask = useMutation(api.pastoralTasks.create);
  const deleteDateMut = useMutation(api.attendance.deleteDate);
  const updateDateMut = useMutation(api.attendance.updateDate);
  const { user, token } = useAuth();
  const { scope, scopeLabel } = useScope();
  const activeScopeArgs = {
    campusId: scope.campusId as any,
    ministryId: scope.ministryId as any,
    groupId: scope.groupId as any,
  };
  const sessions = useQuery(api.attendance.listSessions, token ? { token, ...activeScopeArgs } : {}) ?? [];
  const needsContact = useQuery(api.attendance.getNeedsContact, token ? { token, ...activeScopeArgs } : {}) ?? [];
  const openTasks = useQuery(api.pastoralTasks.listOpenForDashboard, token ? { token, ...activeScopeArgs } : "skip") ?? [];

  const [selectedDate, setSelectedDate] = useState(
    allDates[allDates.length - 1] || todayISO()
  );
  const [showNewDate, setShowNewDate] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [newMeetingType, setNewMeetingType] = useState<MeetingType>("culto_adolescentes");
  const [newObjective, setNewObjective] = useState("");
  const [newExpectedAttendance, setNewExpectedAttendance] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "unmarked" | AttendanceStatus>("all");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showOptionalSessionDetails, setShowOptionalSessionDetails] = useState(false);
  const [showCompleteSession, setShowCompleteSession] = useState(false);
  const [resultNotes, setResultNotes] = useState("");
  const [completedStats, setCompletedStats] = useState<{ present: number; absent: number; excused: number; unmarked: number; completionState: "complete" | "incomplete" } | null>(null);
  const [showEditDate, setShowEditDate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editDateValue, setEditDateValue] = useState(selectedDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [taskCreatingId, setTaskCreatingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletedDates, setDeletedDates] = useState<string[]>([]);
  const [attendanceDetail, setAttendanceDetail] = useState<{
    teenId: string;
    teenName: string;
    status: "absent" | "excused";
    value: string;
  } | null>(null);
  const [celebration, setCelebration] = useState<{
    name: string;
    streakTier: ReturnType<typeof streakTier>;
    newBadges: any[];
  } | null>(null);
  const pendingCheck = useRef<{ teenId: string; name: string; status: AttendanceStatus; oldPresentStreak: number } | null>(null);

  useEffect(() => {
    setEditDateValue(selectedDate);
  }, [selectedDate]);

  const sessionDates = sessions.map((s: any) => s.date);
  const recent = [...new Set([...allDates, ...sessionDates])].sort().slice(-10);
  const selectedSession = sessions.find((s: any) => String(s._id) === selectedSessionId);
  const sessionSummary = useQuery(api.attendance.getSessionSummary, token ? { token, date: selectedDate, sessionId: selectedSessionId ? selectedSessionId as any : undefined, ...activeScopeArgs } : "skip") as any;
  const upcomingSessions = sessions.filter((s: any) => s.date >= todayISO() && s.status !== "canceled").sort((a: any, b: any) => a.date.localeCompare(b.date));
  const visibleUpcomingSessions = showAllUpcoming ? upcomingSessions : upcomingSessions.slice(0, 3);
  const dayMap = Object.fromEntries((sessionSummary?.records ?? []).map((record: any) => [String(record.teenId), record.status]));

  useEffect(() => {
    const sessionsForDate = sessions.filter((session: any) => session.date === selectedDate);
    if (selectedSessionId && sessionsForDate.some((session: any) => String(session._id) === selectedSessionId)) return;
    setSelectedSessionId(sessionsForDate[0] ? String(sessionsForDate[0]._id) : "");
  }, [selectedDate, selectedSessionId, sessions]);

  const markAttendance = async (teenId: string, status: AttendanceStatus, detailText?: string) => {
    const teen = teens.find((t) => t._id === teenId);
    if (status === "present" && teen) {
      const old = statsFor(teenId, attendanceMap);
      pendingCheck.current = { teenId, name: teen.nombre, status, oldPresentStreak: old.presentStreak };
    }
    setPendingCount((c) => c + 1);
    try {
      const detail =
        status === "present"
          ? {}
          : status === "excused"
          ? { excuseReason: detailText || undefined }
          : { absenceComment: detailText || undefined };
      await markAtt({
        token: token ?? undefined,
        sessionId: selectedSessionId ? (selectedSessionId as any) : undefined,
        date: selectedDate,
        teenId: teenId as any,
        status,
        checkInMethod: "mobile",
        ...detail,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
    }
  };

  const handleMark = async (teenId: string, status: AttendanceStatus) => {
    const teen = teens.find((t) => t._id === teenId);
    if (status === "present") {
      await markAttendance(teenId, status);
      return;
    }
    setAttendanceDetail({
      teenId,
      teenName: teen ? `${teen.nombre} ${teen.apellido}`.trim() : "Adolescente",
      status,
      value: "",
    });
  };

  const submitAttendanceDetail = async () => {
    if (!attendanceDetail) return;
    const { teenId, status, value } = attendanceDetail;
    setAttendanceDetail(null);
    await markAttendance(teenId, status, value.trim());
  };

  useEffect(() => {
    if (!pendingCheck.current) return;
    const { teenId, name, oldPresentStreak } = pendingCheck.current;
    pendingCheck.current = null;
    const newStats = statsFor(teenId, attendanceMap);
    const newGame = getGamification(newStats);
    const newBadges = newGame.badges.filter((b) => {
      return b.unlocked && (b.meta.id === "first_attendance" && oldPresentStreak === 0) || (b.meta.id === "bronze" && newStats.total >= 4) || (b.meta.id === "silver" && newStats.total >= 12) || (b.meta.id === "gold" && newStats.total >= 24) || (b.meta.id === "perfect_month" && newStats.presentStreak >= 4 && oldPresentStreak < 4);
    });
    const newTier = streakTier(newStats.presentStreak);
    const oldTier = streakTier(oldPresentStreak);
    if (newBadges.length > 0 || (newTier && newTier.label !== oldTier?.label)) {
      setCelebration({ name, streakTier: newTier, newBadges });
    }
  }, [attendanceMap]);

  const handleNewDate = async () => {
    setShowNewDate(false);
    if (!newDate || !token) return;
    const id = await createSession({
      token,
      date: newDate,
      type: newMeetingType,
      campusId: scope.campusId ? (scope.campusId as any) : undefined,
      ministryId: scope.ministryId ? (scope.ministryId as any) : undefined,
      groupId: scope.groupId ? (scope.groupId as any) : undefined,
      title: MEETING_LABELS[newMeetingType],
      objective: newObjective || undefined,
      expectedAttendance: newExpectedAttendance ? Number(newExpectedAttendance) : undefined,
    });
    setSelectedDate(newDate);
    setSelectedSessionId(String(id));
  };

  const handleDeleteDate = async () => {
    if (!token) return;
    setShowDeleteConfirm(false);
    const dateToDelete = selectedDate;
    try {
      await deleteDateMut({ token, date: dateToDelete });
      // Marcar la fecha como eliminada localmente para que desaparezca del chip selector
      setDeletedDates(prev => [...prev, dateToDelete]);
      const remainingDates = allDates.filter((d) => d !== dateToDelete);
      const nextDate = remainingDates[remainingDates.length - 1] || todayISO();
      setSelectedDate(nextDate);
      setSuccessMsg("✔ Fecha eliminada correctamente.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setSuccessMsg("Error: " + err.message);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleSaveEditDate = async () => {
    if (!token) return;
    if (!editDateValue || editDateValue === selectedDate) {
      setShowEditDate(false);
      return;
    }
    try {
      await updateDateMut({ token, oldDate: selectedDate, newDate: editDateValue });
      setSelectedDate(editDateValue);
      setShowEditDate(false);
      setSuccessMsg("Fecha modificada con éxito.");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setSuccessMsg("Error: " + err.message);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const rosterTeens = teens.filter((t) =>
    (!selectedSession?.groupId || String(t.groupId || "") === String(selectedSession.groupId))
  );
  const filteredTeens = rosterTeens.filter((teen) => {
    const status = dayMap[teen._id] || "unmarked";
    const matchesSearch = `${teen.nombre} ${teen.apellido}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && (attendanceFilter === "all" || status === attendanceFilter);
  });
  const counts = sessionSummary?.counts ?? { present: 0, absent: 0, excused: 0, marked: 0 };
  const rosterTotal = sessionSummary?.total ?? rosterTeens.length;
  const unmarkedCount = Math.max(0, rosterTotal - counts.marked);
  const completionPct = rosterTotal ? Math.round((counts.marked / rosterTotal) * 100) : 0;
  const filterCounts = { all: rosterTotal, unmarked: unmarkedCount, present: counts.present, excused: counts.excused, absent: counts.absent };
  const hasOpenTask = (teenId: string) => openTasks.some((task: any) => String(task.teenId) === teenId);

  const createTaskFromSignal = async (item: any) => {
    if (!token || hasOpenTask(String(item.teenId))) return;
    setTaskCreatingId(String(item.teenId));
    try {
      await createPastoralTask({
        token,
        teenId: item.teenId,
        source: "manual",
        title: `Dar seguimiento: ${item.reasons[0]}`,
        description: item.reasons.join(" · "),
        priority: item.priority,
      });
    } finally {
      setTaskCreatingId(null);
    }
  };

  const finishSession = async (allowIncomplete: boolean) => {
    if (!token || !selectedSession) return;
    try {
      const stats = await completeSession({ token, sessionId: selectedSession._id, resultNotes, allowIncomplete });
      setCompletedStats(stats);
      setShowCompleteSession(false);
      setResultNotes("");
    } catch (error) {
      setSuccessMsg(`Error: ${error instanceof Error ? error.message : "No se pudo cerrar la actividad."}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header: 2 filas limpias */}
      <div className="space-y-2">
        {/* Fila 1: label + botón Nueva Fecha */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-primary-700 tracking-wide uppercase">Tomar asistencia</p>
          <button
            onClick={() => setShowNewDate(true)}
            className="game-pill game-pill--primary flex items-center gap-1.5 shrink-0 pressable"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva fecha
          </button>
        </div>
        {/* Fila 2: fecha grande + iconos de acción + badge guardado */}
        <div className="flex items-end justify-between gap-2">
          <h1 className="font-display text-2xl font-bold leading-tight">{fmtDate(selectedDate)}</h1>
          <div className="flex items-center gap-2 pb-0.5 shrink-0">
            {(user?.role === "pastor" || user?.role === "admin") && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowEditDate(true)}
                  className="feature-icon feature-icon--primary hover:bg-primary-100 transition pressable"
                  title="Editar fecha"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="feature-icon feature-icon--danger hover:bg-danger-100 transition pressable"
                  title="Eliminar fecha completa"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            )}
            {/* Indicador de sincronización */}
            <div className="text-[10px] font-semibold">
              {pendingCount > 0 ? (
                <span className="flex items-center gap-1 text-warning-600 bg-warning-50 dark:bg-warning-950/20 dark:text-warning-400 px-2 py-0.5 rounded-full border border-warning-100 animate-pulse">
                  <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sync...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-success-700 bg-success-50 px-2.5 py-1 rounded-full border border-success-100">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  Guardado
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {recent.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border whitespace-nowrap ${
              d === selectedDate
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-card text-ink/60 border-ink/10"
            }`}
          >
            {fmtDateShort(d)}
          </button>
        ))}
      </div>

      {sessions.filter((s: any) => s.date === selectedDate).length > 0 && (
        <div className="game-card p-4">
          <div className="flex items-start justify-between gap-3"><div><label className="text-xs font-bold text-ink/45 uppercase tracking-wide">Sesión</label><p className="mt-1 text-xs text-ink/50">{scopeLabel}</p></div>{selectedSession?.status === "completed" && <span className={`rounded-full px-2 py-1 text-micro font-semibold ${selectedSession.completionState === "incomplete" ? "bg-warning-50 text-warning-700" : "bg-success-50 text-success-700"}`}>{selectedSession.completionState === "incomplete" ? "Cierre incompleto" : "Cerrada"}</span>}</div>
          <select value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)} className="mt-2 w-full bg-ink/[0.03] border border-ink/10 rounded-xl px-3 py-2 text-sm font-semibold">
            <option value="">Registro histórico sin sesión</option>
            {sessions.filter((s: any) => s.date === selectedDate).map((s: any) => <option key={s._id} value={s._id}>{MEETING_LABELS[s.type as MeetingType]}{s.title ? ` - ${s.title}` : ""}</option>)}
          </select>
          {selectedSessionId && <>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold"><button type="button" onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}?session=${selectedSessionId}&checkIn=${selectedSession?.checkInToken || ""}`)} className="text-primary-700 underline underline-offset-2">Copiar URL segura de check-in</button>{selectedSession?.status !== "completed" && <button type="button" onClick={() => setShowCompleteSession(true)} className="text-ink/65 underline underline-offset-2">Cerrar actividad</button>}</div>
            {(selectedSession?.objective || selectedSession?.expectedAttendance) && <p className="mt-2 text-xs text-ink/55">{selectedSession.objective ? `Objetivo: ${selectedSession.objective}` : ""}{selectedSession.objective && selectedSession.expectedAttendance ? " · " : ""}{selectedSession.expectedAttendance ? `Esperados: ${selectedSession.expectedAttendance}` : ""}</p>}
            {selectedSession?.status === "completed" && <p className="mt-2 text-xs text-ink/55">Actividad cerrada{selectedSession.resultNotes ? ` · ${selectedSession.resultNotes}` : ""}</p>}
          </>}
        </div>
      )}

      {upcomingSessions.length > 0 && <section className="game-card p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="feature-icon feature-icon--primary"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></span><div><p className="text-xs font-bold uppercase text-primary-700">Agenda del ámbito</p><p className="mt-1 text-sm text-ink/50">Próximas actividades planificadas.</p></div></div><span className="text-xs text-ink/40">{scopeLabel}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{visibleUpcomingSessions.map((session: any) => <button key={session._id} onClick={() => { setSelectedDate(session.date); setSelectedSessionId(String(session._id)); }} className="rounded-xl border border-ink/10 px-3 py-2.5 text-left hover:border-primary-300"><p className="text-sm font-bold">{MEETING_LABELS[session.type as MeetingType]}</p><p className="mt-1 text-xs text-ink/55">{session.date}{session.objective ? ` · ${session.objective}` : ""}</p><p className="mt-1 text-xs text-primary-700">{session.status === "completed" ? "Cerrada" : "Planificada"}{session.expectedAttendance ? ` · Esperados ${session.expectedAttendance}` : ""}</p></button>)}</div>{upcomingSessions.length > 3 && <button type="button" onClick={() => setShowAllUpcoming((value) => !value)} className="mt-3 text-xs font-semibold text-primary-700 underline underline-offset-2">{showAllUpcoming ? "Ver menos" : `Ver las ${upcomingSessions.length} actividades`}</button>}</section>}

      {needsContact.length > 0 && (
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-3.5">
          <p className="text-sm font-bold text-primary-700">Adolescentes que necesitan contacto esta semana</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {needsContact.slice(0, 5).map((item: any) => (
              <div key={String(item.teenId)} className="rounded-xl border border-primary-100 bg-white/70 px-3 py-2 text-xs"><button type="button" onClick={() => onOpenProfile(String(item.teenId))} className="w-full text-left"><span className="font-semibold text-ink">{item.teenName}</span><span className="block text-primary-700">{item.reasons.join(" · ")}</span></button><div className="mt-2 flex gap-2"><button type="button" onClick={() => onOpenProfile(String(item.teenId))} className="text-xs font-semibold text-primary-700 underline underline-offset-2">Abrir ficha</button>{hasOpenTask(String(item.teenId)) ? <span className="text-xs text-success-700">Tarea abierta</span> : <button type="button" disabled={taskCreatingId === String(item.teenId)} onClick={() => createTaskFromSignal(item)} className="text-xs font-semibold text-primary-700 underline underline-offset-2 disabled:opacity-50">{taskCreatingId === String(item.teenId) ? "Creando..." : "Crear tarea"}</button>}</div></div>
            ))}
          </div>
        </div>
      )}

      {rosterTeens.length === 0 ? (
        <div className="text-center py-8 px-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-ink/5 flex items-center justify-center mb-3 text-ink/30">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M8 2v4M16 2v4M3 10h18" />
              <path d="M8.5 14.5l2 2 4-4" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink/70">
            No hay adolescentes registrados
          </p>
          <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">
            Agrega adolescentes en la sección correspondiente para poder tomar
            asistencia.
          </p>
        </div>
      ) : (
        <>
          <section className="ui-card p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-primary-700">Estado del registro</p><p className="mt-1 text-sm font-semibold text-ink">{counts.marked} de {rosterTotal} marcados</p></div><span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700">{completionPct}%</span></div>
            <div className="progress-track mt-3"><div className="progress-fill" style={{ width: `${completionPct}%` }} /></div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><span className="rounded-lg bg-success-50 px-1.5 py-2 text-success-700"><strong className="block text-sm">{counts.present}</strong>Presentes</span><span className="rounded-lg bg-warning-50 px-1.5 py-2 text-warning-700"><strong className="block text-sm">{counts.excused}</strong>Justificados</span><span className="rounded-lg bg-danger-50 px-1.5 py-2 text-danger-700"><strong className="block text-sm">{counts.absent}</strong>Ausentes</span><span className="rounded-lg bg-neutral-100 px-1.5 py-2 text-neutral-700"><strong className="block text-sm">{unmarkedCount}</strong>Pendientes</span></div>
          </section>
          {/* Buscador de asistencia */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar adolescente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-ink/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600/30 transition-all"
            />
            <svg className="w-4 h-4 text-ink/30 absolute left-3.5 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-ink/40 hover:text-ink/60 underline absolute right-3.5 top-1/2 -translate-y-1/2"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar asistencia">
            {([ ["all", "Todos"], ["unmarked", "Sin marcar"], ["present", "Presentes"], ["excused", "Justificados"], ["absent", "Ausentes"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={attendanceFilter === id} onClick={() => setAttendanceFilter(id)} className={`ui-segment shrink-0 border ${attendanceFilter === id ? "border-primary-600 bg-primary-600 text-white" : "border-ink/10 bg-card text-ink/60"}`}>{label} ({filterCounts[id]})</button>)}
          </div>

          {filteredTeens.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-card shadow-soft border border-ink/5">
              <p className="text-sm font-semibold text-ink/60">No se encontraron resultados</p>
              <p className="text-xs text-ink/40 mt-0.5">Ningún adolescente coincide con "{searchQuery}"</p>
            </div>
          ) : (
            <div className="bg-card rounded-card shadow-soft divide-y divide-ink/5 overflow-hidden">
              {filteredTeens.map((t) => {
                const st = dayMap[t._id] || "unmarked";
                return (
                  <div
                    key={t._id}
                    className="flex items-center gap-3 p-3.5"
                  >
                    <Avatar teen={t} />
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onOpenProfile(t._id)}
                    >
                      <p className="text-sm font-semibold truncate">
                        {t.nombre} {t.apellido}
                      </p>
                      <p className="text-xs text-ink/40">
                        {statsFor(t._id, attendanceMap).pct}% asistencia general
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <AttBtn
                        status="present"
                        label="✓"
                        current={st}
                        onClick={() => handleMark(t._id, "present")}
                        activeClass="bg-success-600 text-white border-success-600"
                        disabled={selectedSession?.status === "completed"}
                      />
                      <AttBtn
                        status="excused"
                        label="J"
                        current={st}
                        onClick={() => handleMark(t._id, "excused")}
                        activeClass="bg-warning-600 text-white border-warning-600"
                        disabled={selectedSession?.status === "completed"}
                      />
                      <AttBtn
                        status="absent"
                        label="✕"
                        current={st}
                        onClick={() => handleMark(t._id, "absent")}
                        activeClass="bg-danger-600 text-white border-danger-600"
                        disabled={selectedSession?.status === "completed"}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-ink/40 px-1">
            ✓ Presente &nbsp;·&nbsp; J Justificado &nbsp;·&nbsp; ✕ Ausente
          </p>
        </>
      )}

      {showNewDate && (
        <Modal title="Crear sesión de asistencia" onClose={() => setShowNewDate(false)}>
          <div className="space-y-5 p-4 sm:p-5">
            <div className="flex items-center gap-3 rounded-lg border border-ink/5 bg-ink/[0.03] px-3 py-2.5">
              <div className="size-8 shrink-0 rounded-lg bg-primary-50 dark:bg-primary-900/40 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-primary-700 dark:text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>
                  <path d="M8.5 14.5l2 2 4-4"/>
                </svg>
              </div>
              <p className="text-xs text-ink/65 leading-relaxed">
                Selecciona la fecha y el tipo de reunión.
              </p>
            </div>

            {/* Input de fecha */}
            <div>
              <label className="text-xs font-bold text-ink/60 uppercase tracking-wider mb-2 block">
                Fecha de la reunión
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-card border border-ink/10 focus:border-primary-500 rounded-lg px-4 py-3 text-sm font-semibold outline-none transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink/60 uppercase tracking-wider mb-2 block">
                Tipo de reunión
              </label>
              <select
                value={newMeetingType}
                onChange={(e) => setNewMeetingType(e.target.value as MeetingType)}
                className="w-full bg-card border border-ink/10 focus:border-primary-500 rounded-lg px-4 py-3 text-sm font-semibold outline-none transition-colors"
              >
                {Object.entries(MEETING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-ink/45">
                Se registrará en: <span className="font-semibold text-ink/65">{scopeLabel}</span>
              </p>
            </div>

            <details open={showOptionalSessionDetails} onToggle={(event) => setShowOptionalSessionDetails((event.target as HTMLDetailsElement).open)} className="rounded-xl border border-ink/10 bg-ink/[0.02] p-3">
              <summary className="cursor-pointer text-xs font-semibold text-primary-700">Detalles opcionales</summary>
              <div className="mt-3 space-y-3"><label className="block text-xs font-semibold text-ink/60">Objetivo de la actividad</label><input value={newObjective} onChange={(e) => setNewObjective(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-card px-3 py-2 text-sm" placeholder="Ej. Integrar a visitantes" /><label className="block text-xs font-semibold text-ink/60">Asistencia esperada</label><input value={newExpectedAttendance} onChange={(e) => setNewExpectedAttendance(e.target.value)} type="number" min="0" className="w-full rounded-xl border border-ink/10 bg-card px-3 py-2 text-sm" placeholder="Ej. 20" /></div>
            </details>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowNewDate(false)}
                className="rounded-lg border border-ink/10 px-4 py-3 text-sm font-semibold text-ink/55 hover:bg-ink/5 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleNewDate}
                className="rounded-lg bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 transition pressable"
              >
                Crear sesión y tomar asistencia
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEditDate && (
        <Modal title="Editar fecha de asistencia" onClose={() => setShowEditDate(false)}>
          <div className="space-y-5">
            {/* Advertencia */}
            <div className="flex items-start gap-3 p-3.5 bg-warning-50 dark:bg-warning-950/20 rounded-xl border border-warning-100 dark:border-warning-900/30">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-warning-100 dark:bg-warning-900/40 flex items-center justify-center">
                <svg className="w-4 h-4 text-warning-700 dark:text-warning-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4"/><path d="M12 17h.01"/>
                  <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>
                </svg>
              </div>
              <p className="text-xs text-warning-800 dark:text-warning-300 leading-relaxed">
                Se actualizará la fecha de <strong>todos</strong> los registros de asistencia de este día. Esta acción no se puede deshacer.
              </p>
            </div>

            {/* Input de fecha */}
            <div>
              <label className="text-xs font-bold text-ink/60 uppercase tracking-wider mb-2 block">
                Nueva fecha
              </label>
              <input
                type="date"
                value={editDateValue}
                onChange={(e) => setEditDateValue(e.target.value)}
                className="w-full bg-card border-2 border-ink/10 focus:border-primary-500 rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleSaveEditDate}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition pressable"
              >
                Guardar cambios
              </button>
              <button
                onClick={() => setShowEditDate(false)}
                className="w-full py-2.5 border border-ink/10 rounded-xl text-xs font-semibold text-ink/50 hover:bg-ink/5 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCompleteSession && selectedSession && <Modal title="Cerrar actividad" onClose={() => setShowCompleteSession(false)}><div className="space-y-4 p-4 sm:p-5"><p className="text-sm text-ink/60">Registra un breve resultado. La asistencia se conserva y el cierre queda auditado.</p>{unmarkedCount > 0 && <div className="rounded-xl border border-warning-100 bg-warning-50 p-3"><p className="text-sm font-bold text-warning-800">Quedan {unmarkedCount} adolescente(s) sin marcar</p><p className="mt-1 text-xs text-warning-700">Revísalos antes de cerrar. También puedes confirmar un cierre incompleto sin convertirlos en ausentes.</p><div className="mt-2 flex flex-wrap gap-1.5">{(sessionSummary?.pendingTeens ?? []).slice(0, 8).map((teen: any) => <span key={String(teen._id)} className="rounded-full border border-warning-200 bg-card px-2 py-1 text-micro text-warning-800">{teen.name}</span>)}</div>{(sessionSummary?.pendingTeens?.length ?? 0) > 8 && <p className="mt-2 text-xs text-warning-700">Y {sessionSummary.pendingTeens.length - 8} más.</p>}</div>}<textarea value={resultNotes} onChange={(e) => setResultNotes(e.target.value)} rows={4} placeholder="Resultado, participación, acuerdos o novedades" className="w-full rounded-xl border border-ink/10 p-3 text-sm"/><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setShowCompleteSession(false)} className="rounded-lg border border-ink/10 px-3 py-2 text-sm font-semibold">Cancelar</button>{unmarkedCount > 0 ? <><button onClick={() => { setAttendanceFilter("unmarked"); setShowCompleteSession(false); }} className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700">Revisar pendientes</button><button onClick={() => finishSession(true)} className="rounded-lg bg-warning-600 px-3 py-2 text-sm font-semibold text-white">Confirmar cierre incompleto</button></> : <button onClick={() => finishSession(false)} className="rounded-lg bg-primary-700 px-3 py-2 text-sm font-semibold text-white">Cerrar actividad</button>}</div></div></Modal>}
      {completedStats && <div className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm text-white shadow-lg ${completedStats.completionState === "incomplete" ? "bg-warning-600" : "bg-primary-600"}`}>Actividad cerrada: {completedStats.present} presentes, {completedStats.absent} ausentes y {completedStats.excused} justificados{completedStats.unmarked ? ` · ${completedStats.unmarked} sin marcar` : ""}.<button onClick={() => setCompletedStats(null)} className="ml-3 text-xs underline">Cerrar</button></div>}

      {/* Modal custom de confirmación de eliminación */}
      {showDeleteConfirm && (
        <Modal title="Eliminar fecha" onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-danger-50 dark:bg-danger-950/20 rounded-xl border border-danger-100 dark:border-danger-900/30">
              <div className="w-8 h-8 shrink-0 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-danger-600 dark:text-danger-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                  <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-danger-800 dark:text-danger-300">¿Eliminar la fecha {fmtDate(selectedDate)}?</p>
                <p className="text-xs text-danger-600/80 dark:text-danger-400/80 mt-0.5 leading-relaxed">
                  Esta acción es <strong>permanente e irreversible</strong>. Se borrarán todas las asistencias registradas para este día.
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 sm:flex-none px-4 py-2.5 border border-ink/10 rounded-xl text-xs font-semibold text-ink/60 hover:bg-ink/5 transition text-center"
              >
                Cancelar, mantener fecha
              </button>
              <button
                onClick={handleDeleteDate}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-danger-600 hover:bg-danger-700 text-white rounded-xl text-xs font-bold transition pressable text-center"
              >
                Sí, eliminar fecha
              </button>
            </div>
          </div>
        </Modal>
      )}

      {attendanceDetail && (
        <Modal
          title={attendanceDetail.status === "excused" ? "Justificar ausencia" : "Registrar ausencia"}
          onClose={() => setAttendanceDetail(null)}
        >
          <div className="p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink">{attendanceDetail.teenName}</p>
              <p className="text-xs text-ink/45 mt-0.5">
                {attendanceDetail.status === "excused"
                  ? "Indica el motivo de justificación para dejarlo registrado."
                  : "Agrega un comentario breve sobre la ausencia."}
              </p>
            </div>
            <textarea
              value={attendanceDetail.value}
              onChange={(event) => setAttendanceDetail({ ...attendanceDetail, value: event.target.value })}
              rows={4}
              autoFocus
              placeholder={attendanceDetail.status === "excused" ? "Ej. Enfermedad, viaje familiar..." : "Ej. No respondió, avisó el apoderado..."}
              className="w-full resize-none rounded-xl border border-ink/10 bg-card px-3.5 py-3 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            />
            {attendanceDetail.status === "excused" && <div className="flex flex-wrap gap-2">{["Estudios", "Salud", "Trabajo", "Familia", "Transporte", "Otro"].map((reason) => <button key={reason} type="button" onClick={() => setAttendanceDetail({ ...attendanceDetail, value: attendanceDetail.value ? attendanceDetail.value : reason })} className="rounded-full border border-ink/10 px-2.5 py-1 text-xs font-semibold text-ink/60 hover:border-primary-300">{reason}</button>)}</div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAttendanceDetail(null)}
                className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 hover:bg-ink/5 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitAttendanceDetail}
                className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition pressable"
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast de éxito / error */}
      {successMsg && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
          successMsg.startsWith("Error")
            ? "bg-danger-600 text-white"
            : "bg-primary-600 text-white"
        }`}>
          {successMsg.startsWith("Error") ? (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
          )}
          {successMsg}
        </div>
      )}

      {celebration && (
        <CelebrationToast
          name={celebration.name}
          streakTier={celebration.streakTier}
          newBadges={celebration.newBadges}
          onDone={() => setCelebration(null)}
        />
      )}
    </div>
  );
}

function AttBtn({
  status,
  label,
  current,
  onClick,
  activeClass,
  disabled = false,
}: {
  status: string;
  label: string;
  current: string;
  onClick: () => void;
  activeClass: string;
  disabled?: boolean;
}) {
  const isActive = current === status;
  const labelByStatus: Record<string, string> = { present: "Marcar presente", excused: "Justificar ausencia", absent: "Marcar ausente" };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={labelByStatus[status]}
      title={disabled ? "La sesión está cerrada" : labelByStatus[status]}
      className={`w-10 h-10 min-w-[44px] rounded-lg border text-sm font-bold flex items-center justify-center transition focus-visible:ring-2 focus-visible:ring-primary-600/30 disabled:cursor-not-allowed disabled:opacity-50 ${
        isActive
          ? `${activeClass} ring-2 ring-offset-1 ring-white/60`
          : "bg-card border-ink/10 text-ink/30"
      }`}
    >
      {label}
    </button>
  );
}
