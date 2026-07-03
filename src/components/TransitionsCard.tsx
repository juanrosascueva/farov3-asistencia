import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { esc, fmtDate } from "../lib/utils";

export default function TransitionsCard({ teenId }: { teenId: string }) {
  const { token } = useAuth();
  const transitions = useQuery(api.transitions.listByTeen, token ? { teenId: teenId as any, token } : "skip") ?? [];
  const createTransition = useMutation(api.transitions.create);
  const completeTransition = useMutation(api.transitions.complete);
  const cancelTransition = useMutation(api.transitions.cancel);
  const [targetDate, setTargetDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || saving) return;
    setSaving(true);
    try {
      await createTransition({
        teenId: teenId as any,
        token,
        toMinistryKey: "jovenes",
        targetDate: targetDate || undefined,
        reason: reason.trim() || undefined,
      });
      setTargetDate("");
      setReason("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold text-base">Transición ministerial</h2>
        <p className="text-xs text-ink/45 mt-1">Registra salida a jóvenes, traslado o cierre de etapa sin borrar historial.</p>
      </div>
      <form onSubmit={handleSubmit} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
        <input
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          className="rounded-xl border border-ink/10 bg-card px-3 py-2 text-sm"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo o nota pastoral"
          className="rounded-xl border border-ink/10 bg-card px-3 py-2 text-sm"
        />
        <button disabled={!token || saving} className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Planificar
        </button>
      </form>
      <div className="space-y-2">
        {transitions.length === 0 && <p className="text-sm text-ink/40">Sin transiciones registradas.</p>}
        {transitions.map((transition: any) => (
          <div key={transition._id} className="rounded-xl border border-ink/10 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">Hacia {esc(transition.toMinistryKey)}</p>
                <p className="text-xs text-ink/45">
                  {transition.targetDate ? fmtDate(transition.targetDate) : "Sin fecha"} · {esc(transition.status)}
                </p>
              </div>
              {transition.status === "planned" && (
                <div className="flex gap-2">
                  <button onClick={() => completeTransition({ id: transition._id, token: token ?? undefined })} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Completar
                  </button>
                  <button onClick={() => cancelTransition({ id: transition._id, token: token ?? undefined })} className="rounded-lg bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink/60">
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
