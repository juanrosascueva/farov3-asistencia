import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, AttendanceStatus } from "../lib/types";
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

  const [selectedDate, setSelectedDate] = useState(
    allDates[allDates.length - 1] || todayISO()
  );
  const [showNewDate, setShowNewDate] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [celebration, setCelebration] = useState<{
    name: string;
    streakTier: ReturnType<typeof streakTier>;
    newBadges: any[];
  } | null>(null);
  const pendingCheck = useRef<{ teenId: string; name: string; status: AttendanceStatus; oldPresentStreak: number } | null>(null);

  const recent = [
    ...new Set([...lastNSundays(6), ...allDates]),
  ].sort().slice(-10);

  if (!attendanceMap[selectedDate]) {
    attendanceMap[selectedDate] = {};
  }
  const dayMap = attendanceMap[selectedDate] || {};

  const handleMark = (teenId: string, status: AttendanceStatus) => {
    const teen = teens.find((t) => t._id === teenId);
    if (status === "present" && teen) {
      const old = statsFor(teenId, attendanceMap);
      pendingCheck.current = { teenId, name: teen.nombre, status, oldPresentStreak: old.presentStreak };
    }
    markAtt({ date: selectedDate, teenId: teenId as any, status });
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
            Tomar asistencia
          </p>
          <h1 className="font-display text-2xl font-bold mt-0.5">
            {fmtDate(selectedDate)}
          </h1>
        </div>
        <button
          onClick={() => setShowNewDate(true)}
          className="text-xs font-semibold bg-ink text-white rounded-full px-3.5 py-2 flex items-center gap-1.5 shrink-0"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva fecha
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {recent.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold border whitespace-nowrap ${
              d === selectedDate
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-ink/60 border-ink/10"
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
          <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5 overflow-hidden">
            {teens.map((t) => {
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
          <p className="text-[11px] text-ink/40 px-1">
            ✓ Presente &nbsp;·&nbsp; J Justificado &nbsp;·&nbsp; ✕ Ausente
          </p>
        </>
      )}

      {showNewDate && (
        <Modal title="Nueva fecha de asistencia" onClose={() => setShowNewDate(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNewDate();
            }}
            className="p-5 space-y-4"
          >
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Fecha de la reunión
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-ink text-white rounded-xl py-3 text-sm font-semibold"
            >
              Crear y abrir
            </button>
          </form>
        </Modal>
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
      className={`w-8 h-8 rounded-lg border text-sm font-bold flex items-center justify-center transition ${
        isActive
          ? activeClass
          : "bg-white border-ink/10 text-ink/30"
      }`}
    >
      {label}
    </button>
  );
}
