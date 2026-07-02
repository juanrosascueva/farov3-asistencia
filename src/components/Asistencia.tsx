import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, AttendanceStatus } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
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

export default function Asistencia({
  teens,
  attendanceMap,
  onOpenProfile,
}: AsistenciaProps) {
  const allDates = Object.keys(attendanceMap).sort();
  const markAtt = useMutation(api.attendance.mark);
  const deleteDateMut = useMutation(api.attendance.deleteDate);
  const updateDateMut = useMutation(api.attendance.updateDate);
  const { user, token } = useAuth();

  const [selectedDate, setSelectedDate] = useState(
    allDates[allDates.length - 1] || todayISO()
  );
  const [showNewDate, setShowNewDate] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [showEditDate, setShowEditDate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editDateValue, setEditDateValue] = useState(selectedDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [deletedDates, setDeletedDates] = useState<string[]>([]);
  const [celebration, setCelebration] = useState<{
    name: string;
    streakTier: ReturnType<typeof streakTier>;
    newBadges: any[];
  } | null>(null);
  const pendingCheck = useRef<{ teenId: string; name: string; status: AttendanceStatus; oldPresentStreak: number } | null>(null);

  useEffect(() => {
    setEditDateValue(selectedDate);
  }, [selectedDate]);

  const recent = [
    ...new Set([...lastNSundays(6), ...allDates]),
  ].sort().slice(-10).filter(d => !deletedDates.includes(d));

  if (!attendanceMap[selectedDate]) {
    attendanceMap[selectedDate] = {};
  }
  const dayMap = attendanceMap[selectedDate] || {};

  const handleMark = async (teenId: string, status: AttendanceStatus) => {
    const teen = teens.find((t) => t._id === teenId);
    if (status === "present" && teen) {
      const old = statsFor(teenId, attendanceMap);
      pendingCheck.current = { teenId, name: teen.nombre, status, oldPresentStreak: old.presentStreak };
    }
    setPendingCount((c) => c + 1);
    try {
      await markAtt({ date: selectedDate, teenId: teenId as any, status });
    } catch (err) {
      console.error(err);
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
    }
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

  const handleNewDate = () => {
    setShowNewDate(false);
    if (newDate) {
      setSelectedDate(newDate);
    }
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

  const filteredTeens = teens.filter((t) =>
    `${t.nombre} ${t.apellido}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header: 2 filas limpias */}
      <div className="space-y-2">
        {/* Fila 1: label + botón Nueva Fecha */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">Tomar asistencia</p>
          <button
            onClick={() => setShowNewDate(true)}
            className="text-xs font-semibold bg-ink dark:bg-teal-700 text-white rounded-full px-3.5 py-2 flex items-center gap-1.5 shrink-0 pressable"
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
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-teal-600 hover:bg-teal-50 transition pressable"
                  title="Editar fecha"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ink/30 hover:text-red-500 hover:bg-red-50 transition pressable"
                  title="Eliminar fecha completa"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            )}
            {/* Indicador de sincronización */}
            <div className="text-[10px] font-semibold">
              {pendingCount > 0 ? (
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
                  <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sync...
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sage-600 bg-sage-50 dark:bg-green-950/20 dark:text-green-400 px-2 py-0.5 rounded-full border border-sage-100 dark:border-green-900/30">
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
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-card text-ink/60 border-ink/10"
            }`}
          >
            {fmtDateShort(d)}
          </button>
        ))}
      </div>

      {teens.length === 0 ? (
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
          {/* Buscador de asistencia */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar adolescente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-ink/10 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600/30 transition-all"
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

          {filteredTeens.length === 0 ? (
            <div className="text-center py-8 bg-card rounded-card shadow-soft border border-ink/5">
              <p className="text-sm font-semibold text-ink/60">No se encontraron resultados</p>
              <p className="text-xs text-ink/40 mt-0.5">Ningún adolescente coincide con "{searchQuery}"</p>
            </div>
          ) : (
            <div className="bg-card rounded-card shadow-soft divide-y divide-ink/5 overflow-hidden">
              {filteredTeens.map((t) => {
                const st = dayMap[t._id] || "sin marcar";
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
                        activeClass="bg-sage-600 text-white border-sage-600"
                      />
                      <AttBtn
                        status="excused"
                        label="J"
                        current={st}
                        onClick={() => handleMark(t._id, "excused")}
                        activeClass="bg-amber-600 text-white border-amber-600"
                      />
                      <AttBtn
                        status="absent"
                        label="✕"
                        current={st}
                        onClick={() => handleMark(t._id, "absent")}
                        activeClass="bg-coral-600 text-white border-coral-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-ink/40 px-1">
            ✓ Presente &nbsp;·&nbsp; J Justificado &nbsp;·&nbsp; ✕ Ausente
          </p>
        </>
      )}

      {showNewDate && (
        <Modal title="Agregar nueva fecha" onClose={() => setShowNewDate(false)}>
          <div className="space-y-5">
            {/* Ícono decorativo */}
            <div className="flex items-center gap-3 p-3.5 bg-teal-50 dark:bg-teal-950/20 rounded-xl border border-teal-100 dark:border-teal-900/30">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-teal-700 dark:text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>
                  <path d="M8.5 14.5l2 2 4-4"/>
                </svg>
              </div>
              <p className="text-xs text-teal-800 dark:text-teal-300 leading-relaxed">
                Elige la fecha de la reunión para registrar asistencia. Normalmente es el domingo de la semana en curso.
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
                className="w-full bg-card border-2 border-ink/10 focus:border-teal-500 rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleNewDate}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition pressable"
              >
                Cargar fecha
              </button>
              <button
                onClick={() => setShowNewDate(false)}
                className="w-full py-2.5 border border-ink/10 rounded-xl text-xs font-semibold text-ink/50 hover:bg-ink/5 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEditDate && (
        <Modal title="Editar fecha de asistencia" onClose={() => setShowEditDate(false)}>
          <div className="space-y-5">
            {/* Advertencia */}
            <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-700 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4"/><path d="M12 17h.01"/>
                  <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>
                </svg>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
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
                className="w-full bg-card border-2 border-ink/10 focus:border-teal-500 rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleSaveEditDate}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition pressable"
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

      {/* Modal custom de confirmación de eliminación */}
      {showDeleteConfirm && (
        <Modal title="Eliminar fecha" onClose={() => setShowDeleteConfirm(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
              <div className="w-8 h-8 shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                  <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-red-800 dark:text-red-300">¿Eliminar la fecha {fmtDate(selectedDate)}?</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5 leading-relaxed">
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
                className="flex-1 sm:flex-none px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition pressable text-center"
              >
                Sí, eliminar fecha
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast de éxito / error */}
      {successMsg && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
          successMsg.startsWith("Error")
            ? "bg-red-600 text-white"
            : "bg-teal-600 text-white"
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
}: {
  status: string;
  label: string;
  current: string;
  onClick: () => void;
  activeClass: string;
}) {
  const isActive = current === status;
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 min-w-[44px] rounded-lg border text-sm font-bold flex items-center justify-center transition ${
        isActive
          ? activeClass
          : "bg-card border-ink/10 text-ink/30"
      }`}
    >
      {label}
    </button>
  );
}
