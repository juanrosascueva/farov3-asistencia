import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { statsFor, alertLevel, ageFromDOB, daysToNextBirthday, esc, getGamification } from "../lib/utils";
import { Avatar } from "./Layout";
import TeenForm from "./TeenForm";
import Modal from "./Modal";

interface JovenesProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

export default function Jovenes({
  teens,
  attendanceMap,
  onOpenProfile,
}: JovenesProps) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTeen, setEditingTeen] = useState<Doc<"teens"> | null>(null);
  const [deletingTeen, setDeletingTeen] = useState<Doc<"teens"> | null>(null);

  const deleteTeen = useMutation(api.teens.remove);

  const filtered = teens.filter((t) => {
    const q = query.toLowerCase();
    return (
      !q ||
      (t.nombre + " " + t.apellido).toLowerCase().includes(q)
    );
  });

  const upcoming = teens
    .map((t) => ({ t, days: daysToNextBirthday(t.nacimiento) }))
    .filter((x): x is { t: Doc<"teens">; days: number } => x.days !== null && x.days <= 21)
    .sort((a, b) => a.days - b.days);

  const handleDelete = useCallback(async () => {
    if (!deletingTeen) return;
    await deleteTeen({ id: deletingTeen._id });
    setDeletingTeen(null);
  }, [deletingTeen, deleteTeen]);

  const ringColor = (alert: ReturnType<typeof alertLevel>) =>
    alert
      ? alert.color === "coral"
        ? "#E8590C"
        : alert.color === "amber"
        ? "#F0A33C"
        : "#0B7285"
      : "#2F9E73";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
            Mi grupo
          </p>
          <h1 className="font-display text-2xl font-bold mt-0.5">
            Adolescentes
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
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
          Agregar
        </button>
      </div>

      <div className="relative">
        <svg
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full bg-white border border-ink/10 rounded-xl pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {upcoming.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-card p-3.5 flex items-start gap-3">
          <svg
            className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 21h18" />
            <path d="M5 21v-6a2 2 0 012-2h10a2 2 0 012 2v6" />
            <path d="M12 13V8" />
            <path d="M9 13V9" />
            <path d="M15 13V9" />
            <circle cx="12" cy="5" r="1.3" />
          </svg>
          <div className="text-sm">
            <p className="font-semibold text-amber-700">Próximos cumpleaños</p>
            <p className="text-amber-700/80 text-xs mt-0.5">
              {upcoming
                .map(
                  (u) =>
                    `${esc(u.t.nombre)} (${
                      u.days === 0 ? "hoy" : "en " + u.days + "d"
                    })`
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
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
              <circle cx="9" cy="8" r="3.2" />
              <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              <circle cx="17.5" cy="9.5" r="2.4" />
              <path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink/70">
            No se encontraron adolescentes
          </p>
          <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">
            Intenta otra búsqueda o agrega un nuevo registro.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => {
            const s = statsFor(t._id, attendanceMap);
            const alert = alertLevel(s.consecutiveAbsences);
            const age = ageFromDOB(t.nacimiento);
            const rc = ringColor(alert);
            const game = getGamification(s);
            return (
              <div
                key={t._id}
                onClick={() => onOpenProfile(t._id)}
                className="bg-white rounded-card shadow-soft p-4 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="rounded-full p-[2px]"
                      style={{ background: rc }}
                    >
                      <div className="bg-white rounded-full p-[2px]">
                        <Avatar teen={t} />
                      </div>
                    </div>
                    {alert && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                        style={{ background: rc }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {esc(t.nombre)} {esc(t.apellido)}
                      {game.streakTier && (
                        <span className="text-sm shrink-0" title={`Racha ${game.streakTier.label}: ${s.presentStreak} semanas`}>
                          {game.streakTier.icon}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink/40 flex items-center gap-2">
                      {age !== null ? age + " años" : "—"}
                      {s.total > 0 && (
                        <span className="text-[10px] font-semibold text-ink/30 bg-ink/5 rounded-full px-1.5 py-0.5">
                          Niv.{game.level.level}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-ink/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-600"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-ink/50">
                        {s.pct}%
                      </span>
                    </div>
                  </div>
                </div>
                {t.gustos && (
                  <p className="text-[11px] text-ink/40 mt-3 truncate">
                    🎯 {esc(t.gustos)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <TeenForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}

      {editingTeen && (
        <TeenForm
          teen={editingTeen}
          onClose={() => setEditingTeen(null)}
          onSuccess={() => setEditingTeen(null)}
        />
      )}

      {deletingTeen && (
        <Modal
          title="Eliminar adolescente"
          onClose={() => setDeletingTeen(null)}
        >
          <div className="p-5">
            <p className="text-sm text-ink/70">
              ¿Seguro que deseas eliminar a{" "}
              <strong>
                {esc(deletingTeen.nombre)} {esc(deletingTeen.apellido)}
              </strong>
              ? Se eliminará también su historial de asistencia. Esta acción no
              se puede deshacer.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeletingTeen(null)}
                className="flex-1 bg-ink/5 rounded-xl py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-coral-600 text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
