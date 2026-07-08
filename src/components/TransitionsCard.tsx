import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { esc, fmtDate } from "../lib/utils";

const MINISTRY_TARGETS = [
  { value: "jovenes", label: "Jóvenes" },
  { value: "adultos", label: "Adultos" },
  { value: "otro_ministerio", label: "Otro ministerio" },
];

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificada",
  completed: "Completada",
  canceled: "Cancelada",
};

function ministryTargetLabel(value: string) {
  return MINISTRY_TARGETS.find((target) => target.value === value)?.label || value;
}

export default function TransitionsCard({ teenId }: { teenId: string }) {
  const { token } = useAuth();
  const transitions = useQuery(api.transitions.listByTeen, token ? { teenId: teenId as any, token } : "skip") ?? [];
  const createTransition = useMutation(api.transitions.create);
  const completeTransition = useMutation(api.transitions.complete);
  const cancelTransition = useMutation(api.transitions.cancel);
  const [toMinistryKey, setToMinistryKey] = useState("jovenes");
  const [targetDate, setTargetDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || saving) {
      setError("Necesitas una sesión activa para planificar la transición.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await createTransition({
        teenId: teenId as any,
        token,
        toMinistryKey,
        targetDate: targetDate || undefined,
        reason: reason.trim() || undefined,
      });
      setTargetDate("");
      setReason("");
      setMessage(`Transición a ${ministryTargetLabel(toMinistryKey)} planificada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo planificar la transición.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (transition: any) => {
    if (!token || actionId) return;
    if (!confirm(`¿Completar la transición a ${ministryTargetLabel(transition.toMinistryKey)}? La ficha quedará como egresada.`)) return;
    setActionId(transition._id);
    setError("");
    setMessage("");
    try {
      await completeTransition({ id: transition._id, token });
      setMessage("Transición completada. La ficha quedó como egresada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar la transición.");
    } finally {
      setActionId(null);
    }
  };

  const handleCancel = async (transition: any) => {
    if (!token || actionId) return;
    setActionId(transition._id);
    setError("");
    setMessage("");
    try {
      await cancelTransition({ id: transition._id, token });
      setMessage("Transición cancelada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar la transición.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold text-base">Transición ministerial</h2>
        <p className="text-xs text-ink/45 mt-1">Registra salida a jóvenes, traslado o cierre de etapa sin borrar historial.</p>
      </div>
      {error && <div className="rounded-xl border border-coral-100 bg-coral-50 px-3 py-2 text-sm font-medium text-coral-700">{error}</div>}
      {message && <div className="rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700">{message}</div>}
      <form onSubmit={handleSubmit} className="grid gap-2 lg:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="block">
          <span className="sr-only">Ministerio destino</span>
          <select
            value={toMinistryKey}
            onChange={(event) => setToMinistryKey(event.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-card px-3 py-2.5 text-sm outline-none focus:border-clay"
          >
            {MINISTRY_TARGETS.map((target) => (
              <option key={target.value} value={target.value}>
                Hacia {target.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Fecha objetivo</span>
          <input
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-card px-3 py-2.5 text-sm outline-none focus:border-clay"
          />
        </label>
        <label className="block">
          <span className="sr-only">Motivo o nota pastoral</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo o nota pastoral"
            className="w-full rounded-xl border border-ink/10 bg-card px-3 py-2.5 text-sm outline-none focus:border-clay"
          />
        </label>
        <button disabled={!token || saving} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {saving ? "Planificando..." : "Planificar"}
        </button>
      </form>
      <p className="text-xs text-ink/45">Completar una transición marca la ficha como egresada del ministerio de adolescentes.</p>
      <div className="space-y-2">
        {transitions.length === 0 && <p className="text-sm text-ink/40">Sin transiciones registradas.</p>}
        {transitions.map((transition: any) => (
          <div key={transition._id} className="rounded-xl border border-ink/10 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">Hacia {esc(ministryTargetLabel(transition.toMinistryKey))}</p>
                <p className="text-xs text-ink/45">
                  {transition.targetDate ? fmtDate(transition.targetDate) : "Sin fecha"} · {esc(STATUS_LABELS[transition.status] || transition.status)}
                </p>
              </div>
              {transition.status === "planned" && (
                <div className="flex gap-2">
                  <button disabled={actionId === transition._id} onClick={() => handleComplete(transition)} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    {actionId === transition._id ? "Procesando..." : "Completar"}
                  </button>
                  <button disabled={actionId === transition._id} onClick={() => handleCancel(transition)} className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink/60 disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            {transition.reason && <p className="mt-2 text-xs text-ink/60">{esc(transition.reason)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
