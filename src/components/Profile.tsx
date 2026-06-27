import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import {
  statsFor,
  alertLevel,
  ageFromDOB,
  fmtDate,
  esc,
} from "../lib/utils";
import { Avatar } from "./Layout";
import TeenForm from "./TeenForm";
import Modal from "./Modal";

interface ProfileProps {
  teen: Doc<"teens">;
  attendanceMap: AttendanceMap;
  onBack: () => void;
  onDeleted: () => void;
}

export default function Profile({
  teen,
  attendanceMap,
  onBack,
  onDeleted,
}: ProfileProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const deleteTeen = useMutation(api.teens.remove);

  const s = statsFor(teen._id, attendanceMap);
  const alert = alertLevel(s.consecutiveAbsences);
  const age = ageFromDOB(teen.nacimiento);
  const history = [...s.history].reverse().slice(0, 12);

  const handleDelete = async () => {
    await deleteTeen({ id: teen._id });
    onDeleted();
  };

  const statusMap: Record<string, { label: string; cls: string }> = {
    present: { label: "Presente", cls: "bg-sage-50 text-sage-600" },
    absent: { label: "Ausente", cls: "bg-coral-50 text-coral-600" },
    excused: { label: "Justificado", cls: "bg-amber-50 text-amber-600" },
  };

  const alertColorMap: Record<string, string> = {
    coral: "bg-coral-50 border-coral-100 text-coral-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    teal: "bg-teal-50 border-teal-100 text-teal-700",
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-ink/50 hover:text-ink"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Volver
      </button>

      <div className="bg-white rounded-card shadow-soft p-5">
        <div className="flex items-start gap-4">
          <Avatar teen={teen} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold">
              {esc(teen.nombre)} {esc(teen.apellido)}
            </h1>
            <p className="text-sm text-ink/45">
              {age !== null
                ? age + " años"
                : "Fecha de nacimiento no registrada"}
              {teen.nacimiento ? " · " + fmtDate(teen.nacimiento) : ""}
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 rounded-full px-3 py-1.5 flex items-center gap-1.5"
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
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
                Editar
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="text-xs font-semibold bg-coral-50 text-coral-600 hover:bg-coral-100 rounded-full px-3 py-1.5 flex items-center gap-1.5"
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
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {alert && (
          <div
            className={`mt-4 p-3.5 rounded-xl border flex items-center gap-3 ${
              alertColorMap[alert.color]
            }`}
          >
            <svg
              className="w-5 h-5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            </svg>
            <div className="text-sm flex-1">
              <p className="font-semibold">
                {alert.label}: {s.consecutiveAbsences} falta
                {s.consecutiveAbsences === 1 ? "" : "s"} consecutiva
                {s.consecutiveAbsences === 1 ? "" : "s"}
              </p>
              <p className="text-xs opacity-80">{alert.action}</p>
            </div>
            {(teen.telefonoPadre || teen.telefono) && (
              <a
                href={`tel:${(teen.telefonoPadre || teen.telefono).replace(
                  /[^0-9+]/g,
                  ""
                )}`}
                className="shrink-0 w-9 h-9 rounded-full bg-white/70 flex items-center justify-center"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.9a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.9.4 1.9.6 2.9.7a2 2 0 011.8 2z" />
                </svg>
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCardInline label="Asistencia" value={s.pct + "%"} icon="check" color="teal" />
        <StatCardInline label="Racha actual" value={s.presentStreak} icon="flame" color="amber" />
        <StatCardInline label="Total registrado" value={s.total} icon="users" color="ink" />
      </div>

      <div className="bg-white rounded-card shadow-soft p-5 space-y-4">
        <h2 className="font-display font-semibold text-base">
          Información de contacto
        </h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="Teléfono del adolescente" value={teen.telefono} />
          <InfoRow label="Teléfono del encargado" value={teen.telefonoPadre} />
        </div>
        {teen.gustos && (
          <div>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">
              Gustos e intereses
            </p>
            <p className="text-sm">{esc(teen.gustos)}</p>
          </div>
        )}
        {teen.notas && (
          <div>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">
              Notas pastorales
            </p>
            <p className="text-sm whitespace-pre-line">{esc(teen.notas)}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-card shadow-soft p-5">
        <h2 className="font-display font-semibold text-base mb-3">
          Historial de asistencia
        </h2>
        {history.length === 0 ? (
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
              Sin historial
            </p>
            <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">
              Aún no hay registros de asistencia para este adolescente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const m = statusMap[h.status] || {
                label: h.status,
                cls: "bg-ink/5 text-ink/50",
              };
              return (
                <div
                  key={h.date}
                  className="flex items-center justify-between text-sm py-1.5"
                >
                  <span className="text-ink/60">{fmtDate(h.date)}</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.cls}`}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEdit && (
        <TeenForm
          teen={teen}
          onClose={() => setShowEdit(false)}
          onSuccess={() => setShowEdit(false)}
        />
      )}

      {showDelete && (
        <Modal
          title="Eliminar adolescente"
          onClose={() => setShowDelete(false)}
        >
          <div className="p-5">
            <p className="text-sm text-ink/70">
              ¿Seguro que deseas eliminar a{" "}
              <strong>
                {esc(teen.nombre)} {esc(teen.apellido)}
              </strong>
              ? Se eliminará también su historial de asistencia. Esta acción no
              se puede deshacer.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDelete(false)}
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

function StatCardInline({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    ink: "text-ink bg-ink/5",
    teal: "text-teal-700 bg-teal-50",
    sage: "text-sage-600 bg-sage-50",
    coral: "text-coral-600 bg-coral-50",
    amber: "text-amber-600 bg-amber-50",
  };
  const icons: Record<string, string> = {
    check: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8.5 14.5l2 2 4-4"/>`,
    flame: `<path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c0-1-.3-1.7-.6-2.4.9.6 1.6 1.7 1.6 3.4 0 2.8-1.8 5-4 5s-5-2.5-5-6c0-3.5 2-6.6 5-8z"/>`,
    users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3"/>`,
  };
  return (
    <div className="bg-white rounded-card shadow-soft p-4">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[color] || ""}`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: icons[icon] || "" }}
        />
      </div>
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="text-xs text-ink/45 mt-1">{label}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-ink/80">{value ? esc(value) : "—"}</p>
    </div>
  );
}
