import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { esc } from "../lib/utils";
import { Avatar } from "./Layout";
import { useCampaignWeek } from "../hooks/useCampaignWeek";
import { useAuth } from "../hooks/useAuth";

interface CampanaProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

type FilterStatus = "all" | "pending" | "contacted" | "skipped";

export default function Campana({ teens, onOpenProfile }: CampanaProps) {
  const { currentWeek, goNextWeek, goPrevWeek, goCurrentWeek, weekLabel, isCurrentWeek } = useCampaignWeek();
  const { user } = useAuth();

  const tasks = useQuery(api.contacts.listByWeek, { weekStart: currentWeek }) ?? [];
  const counts = useQuery(api.contacts.getCounts, { weekStart: currentWeek });
  const doAutoPopulate = useMutation(api.contacts.autoPopulate);
  const doMarkContacted = useMutation(api.contacts.markContacted);
  const doMarkSkipped = useMutation(api.contacts.markSkipped);
  const doReset = useMutation(api.contacts.resetToPending);
  const generateMsg = useAction(api.ai.generatePersonalizedMessage as any);
  const [campanaMsg, setCampanaMsg] = useState("");
  const [campanaMsgGenerating, setCampanaMsgGenerating] = useState(false);
  const [campanaTeenId, setCampanaTeenId] = useState<string | null>(null);

  useEffect(() => {
    doAutoPopulate({ weekStart: currentWeek });
  }, [currentWeek, doAutoPopulate]);

  const taskMap = useMemo(() => {
    const m = new Map<string, Doc<"contacts">>();
    for (const t of tasks) m.set(t.teenId, t);
    return m;
  }, [tasks]);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [contactingTeenId, setContactingTeenId] = useState<string | null>(null);
  const [journalCat, setJournalCat] = useState<"call" | "chat" | "visit" | "counseling" | "prayer" | "other">("call");
  const [journalText, setJournalText] = useState("");
  const [createJournalEntry, setCreateJournalEntry] = useState(true);

  const sorted = useMemo(() => {
    const statusOrder: Record<string, number> = { pending: 0, contacted: 1, skipped: 2 };
    return [...teens].sort((a, b) => {
      const ta = taskMap.get(a._id);
      const tb = taskMap.get(b._id);
      const sa = ta?.status ?? "pending";
      const sb = tb?.status ?? "pending";
      return (statusOrder[sa] ?? 0) - (statusOrder[sb] ?? 0);
    });
  }, [teens, taskMap]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return sorted;
    return sorted.filter((t) => {
      const task = taskMap.get(t._id);
      return (task?.status ?? "pending") === statusFilter;
    });
  }, [sorted, statusFilter, taskMap]);

  const handleContacted = useCallback(async (teenId: string) => {
    const leaderName = user?.name || "Líder";
    await doMarkContacted({
      weekStart: currentWeek,
      teenId: teenId as any,
      leaderName,
      notes: undefined,
      createJournal: createJournalEntry,
      journalCategory: journalCat,
      journalContent: journalText || undefined,
    });
    setContactingTeenId(null);
    setJournalText("");
    setJournalCat("call");
    setCreateJournalEntry(true);
  }, [currentWeek, user, doMarkContacted, createJournalEntry, journalCat, journalText]);

  const handleSkipped = useCallback(async (teenId: string) => {
    await doMarkSkipped({ weekStart: currentWeek, teenId: teenId as any });
  }, [currentWeek, doMarkSkipped]);

  const handleReset = useCallback(async (teenId: string) => {
    await doReset({ weekStart: currentWeek, teenId: teenId as any });
  }, [currentWeek, doReset]);

  const pct = counts && counts.total > 0 ? Math.round((counts.contacted / counts.total) * 100) : 0;
  const reached = counts && counts.contacted >= counts.total;

  const filterTabs: { id: FilterStatus; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: teens.length },
    { id: "pending", label: "Pendientes", count: counts?.pending ?? 0 },
    { id: "contacted", label: "Contactados", count: counts?.contacted ?? 0 },
    { id: "skipped", label: "Saltados", count: counts?.skipped ?? 0 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Pastoral
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">
          Campaña de Contacto
        </h1>
      </div>

      <div className="bg-card rounded-card shadow-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={goPrevWeek} className="w-10 h-10 flex items-center justify-center rounded-xl border border-ink/10 text-ink/50 hover:text-ink hover:bg-ink/5 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{weekLabel()}</p>
            {!isCurrentWeek && (
              <button onClick={goCurrentWeek} className="text-[11px] font-semibold text-teal-700 hover:text-teal-600 underline underline-offset-2">
                Volver a esta semana
              </button>
            )}
          </div>
          <button onClick={goNextWeek} className="w-10 h-10 flex items-center justify-center rounded-xl border border-ink/10 text-ink/50 hover:text-ink hover:bg-ink/5 transition">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>

        {counts && counts.total > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink/50">Progreso semanal</span>
              <span className={`font-semibold ${pct >= 100 ? "text-teal-600" : "text-ink/70"}`}>
                {counts.contacted}/{counts.total} contactados
              </span>
            </div>
            <div className="h-2.5 bg-ink/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-teal-600" : "bg-teal-500"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            {pct >= 100 && (
              <p className="text-xs font-semibold text-teal-600 text-center">
                ¡Semana completada! 🎉
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1.5 bg-ink/5 rounded-xl p-1 overflow-x-auto">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap transition ${
              statusFilter === t.id
                ? "bg-card shadow-sm text-ink"
                : "text-ink/50 hover:text-ink"
            }`}
          >
            {t.label} {t.id !== "all" && `(${t.count})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm font-semibold text-ink/50">No hay jóvenes en esta categoría</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((teen) => {
            const task = taskMap.get(teen._id);
            const status = task?.status ?? "pending";
            const isContacting = contactingTeenId === teen._id;

            return (
              <div
                key={teen._id}
                className="bg-card rounded-card shadow-soft p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="shrink-0 cursor-pointer" onClick={() => onOpenProfile(teen._id)}>
                    <Avatar teen={teen} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      onClick={() => onOpenProfile(teen._id)}
                      className="text-sm font-semibold truncate cursor-pointer hover:text-teal-700 transition"
                    >
                      {esc(teen.nombre)} {esc(teen.apellido)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                          status === "contacted"
                            ? "bg-teal-50 text-teal-700"
                            : status === "skipped"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-ink/5 text-ink/50"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          status === "contacted" ? "bg-teal-600" : status === "skipped" ? "bg-amber-500" : "bg-ink/30"
                        }`} />
                        {status === "contacted"
                          ? `Contactado${task?.leaderName ? ` por ${task.leaderName}` : ""}`
                          : status === "skipped"
                          ? "No contactado"
                          : "Pendiente"}
                      </span>
                      {status === "contacted" && task?.contactedAt && (
                        <span className="text-[11px] text-ink/40">
                          {new Date(task.contactedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {status === "pending" && (
                      <>
                        <button
                          onClick={() => setContactingTeenId(teen._id)}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition"
                              title="Marcar como contactado"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </button>
                        <button
                          onClick={() => handleSkipped(teen._id)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-ink/5 text-ink/40 hover:text-amber-600 hover:bg-amber-50 transition"
                          title="Saltar esta semana"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </>
                    )}
                    {(status === "contacted" || status === "skipped") && (
                      <button
                        onClick={() => handleReset(teen._id)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-ink/5 text-ink/40 hover:text-teal-600 hover:bg-teal-50 transition"
                        title="Reabrir"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 102.13-9.36L1 10" /></svg>
                      </button>
                    )}
                  </div>
                </div>

                {isContacting && (
                  <div className="mt-3 pt-3 border-t border-ink/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs font-semibold text-ink/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createJournalEntry}
                          onChange={(e) => setCreateJournalEntry(e.target.checked)}
                          className="rounded border-ink/20 text-teal-600 focus:ring-teal-500"
                        />
                        Crear bitácora pastoral
                      </label>
                    </div>
                    {(teen.telefono || teen.telefonoPadre) && (
                      <div>
                        <button
                          onClick={async () => {
                            setCampanaTeenId(teen._id);
                            setCampanaMsgGenerating(true);
                            const r = await generateMsg({ teenId: teen._id as any, tone: "invitacion" }) as any;
                            if (r.success) setCampanaMsg(r.message);
                            setCampanaMsgGenerating(false);
                          }}
                          disabled={campanaMsgGenerating && campanaTeenId === teen._id}
                          className="w-full flex items-center justify-center gap-2 text-xs font-semibold bg-teal-50 text-teal-700 rounded-xl py-2 hover:bg-teal-100 transition disabled:opacity-50"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /><path d="M15 5l3 3" />
                          </svg>
                          {campanaMsgGenerating && campanaTeenId === teen._id ? "Generando..." : "Generar mensaje con IA"}
                        </button>
                        {campanaMsg && campanaTeenId === teen._id && (
                          <div className="mt-2 p-3 rounded-xl bg-teal-50 border border-teal-100 space-y-2">
                            <textarea
                              value={campanaMsg}
                              onChange={(e) => setCampanaMsg(e.target.value)}
                              rows={3}
                              className="w-full bg-white border border-teal-200 rounded-lg p-2.5 text-xs resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  const phone = teen.telefonoPadre || teen.telefono;
                                  if (!phone) return;
                                  window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(campanaMsg)}`, "_blank");
                                }}
                                className="flex-1 bg-green-600 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-green-700 flex items-center justify-center gap-1"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                Enviar
                              </button>
                              <button onClick={() => { setCampanaMsg(""); setCampanaTeenId(null); }} className="flex-1 bg-ink/5 text-ink/60 rounded-lg py-1.5 text-xs font-semibold">
                                Cerrar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {createJournalEntry && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-ink/50 mb-1 block">Categoría</label>
                          <select
                            value={journalCat}
                            onChange={(e) => setJournalCat(e.target.value as any)}
                            className="w-full bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm"
                          >
                            <option value="call">📞 Llamada</option>
                            <option value="chat">📱 WhatsApp</option>
                            <option value="visit">🏠 Visita</option>
                            <option value="counseling">💬 Consejería</option>
                            <option value="prayer">🙏 Oración</option>
                            <option value="other">📝 Nota</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-ink/50 mb-1 block">Nota (opcional)</label>
                          <textarea
                            value={journalText}
                            onChange={(e) => setJournalText(e.target.value)}
                            rows={2}
                            placeholder="¿Cómo fue el contacto?"
                            className="w-full bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm resize-none"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleContacted(teen._id)}
                        className="flex-1 bg-teal-600 text-white rounded-xl py-2 text-sm font-semibold"
                      >
                        Confirmar contacto
                      </button>
                      <button
                        onClick={() => setContactingTeenId(null)}
                        className="flex-1 bg-ink/5 text-ink/60 rounded-xl py-2 text-sm font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
