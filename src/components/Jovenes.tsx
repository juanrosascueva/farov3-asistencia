import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, RiskInfo } from "../lib/types";
import { statsFor, riskScore, ageFromDOB, daysToNextBirthday, esc, getGamification } from "../lib/utils";
import { Avatar } from "./Layout";
import TeenForm from "./TeenForm";
import Modal from "./Modal";

interface JovenesProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

type SortMode = "nombre" | "riesgo" | "prioridad";

export default function Jovenes({
  teens,
  attendanceMap,
  onOpenProfile,
}: JovenesProps) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTeen, setEditingTeen] = useState<Doc<"teens"> | null>(null);
  const [deletingTeen, setDeletingTeen] = useState<Doc<"teens"> | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("prioridad");

  type FilterFidelidad = "all" | 1 | 2 | 3 | 4;
  type FilterPastoral = "all" | 0 | 1 | 2 | 3 | 4 | 5;
  type FilterEdad = "all" | "12-13" | "14-15" | "16-17" | "18+";

  const [showFilters, setShowFilters] = useState(false);
  const [filtroFidelidad, setFiltroFidelidad] = useState<FilterFidelidad>("all");
  const [filtroPastoral, setFiltroPastoral] = useState<FilterPastoral>("all");
  const [filtroEdad, setFiltroEdad] = useState<FilterEdad>("all");

  const deleteTeen = useMutation(api.teens.remove);
  const recalcPpp = useAction(api.ppp.calculateAllPpp as any);
  const [pppRecalculating, setPppRecalculating] = useState(false);

  const followUps = useQuery(api.journal.listFollowUps);
  const followUpTeenIds = useMemo(() => {
    if (!followUps) return new Set<string>();
    return new Set(followUps.map((e) => e.teenId));
  }, [followUps]);

  const allAnalyses = useQuery(api.ai.getAllAnalyses) ?? [];
  const teenHighRiskMap = useMemo(() => {
    const map = new Map<string, { hasHigh: boolean; hasMedium: boolean }>();
    for (const a of allAnalyses as any[]) {
      const existing = map.get(a.teenId) || { hasHigh: false, hasMedium: false };
      if (a.riskLevel === "high") existing.hasHigh = true;
      if (a.riskLevel === "medium") existing.hasMedium = true;
      map.set(a.teenId, existing);
    }
    return map;
  }, [allAnalyses]);

  const activeFilterCount = [filtroFidelidad, filtroPastoral, filtroEdad].filter((f) => f !== "all").length;

  const ringColor = (risk: RiskInfo) => {
    const colors: Record<RiskInfo["color"], string> = {
      gray: "#6B7280",
      teal: "#0B7285",
      amber: "#F0A33C",
      coral: "#E8590C",
      red: "#DC2626",
    };
    return colors[risk.color];
  };

  const computePPP = (risk: RiskInfo, s: ReturnType<typeof statsFor>, hasFollowUp: boolean, teenId: string): number => {
    const riskFactor = risk.score / 5;
    const v = teenHighRiskMap.get(teenId);
    const vulnFactor = v?.hasHigh ? 1 : v?.hasMedium ? 0.5 : 0;
    const absFactor = Math.min(s.consecutiveAbsences / 10, 1);
    const pctInverted = 1 - s.pct / 100;
    const followUpFactor = hasFollowUp ? 1 : 0;
    return riskFactor * 0.30 + vulnFactor * 0.25 + absFactor * 0.20 + pctInverted * 0.10 + followUpFactor * 0.15;
  };

  const pppLabel = (score: number): string => {
    if (score >= 0.7) return "Crítica";
    if (score >= 0.5) return "Alta";
    if (score >= 0.3) return "Media";
    return "Baja";
  };

  const teenData = teens
    .map((t) => {
      const s = statsFor(t._id, attendanceMap);
      const risk = riskScore(s);
      const ppp = computePPP(risk, s, followUpTeenIds.has(t._id), t._id);
      return { t, s, risk, age: ageFromDOB(t.nacimiento), game: getGamification(s), rc: ringColor(risk), hasFollowUp: followUpTeenIds.has(t._id), ppp };
    })
    .filter(({ t }) => {
      const q = query.toLowerCase();
      return !q || (t.nombre + " " + t.apellido).toLowerCase().includes(q);
    })
    .filter(({ t, s, risk, age, game, hasFollowUp }) => {
      if (activeFilterCount === 0) return true;
      if (filtroFidelidad !== "all" && game.level.level !== filtroFidelidad) return false;
      if (filtroPastoral !== "all" && risk.score !== filtroPastoral) return false;
      if (filtroEdad !== "all") {
        if (age === null) return false;
        const [min, max] = filtroEdad.split("-").map(Number);
        if (age < min || age > max) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === "nombre") return (a.t.nombre + a.t.apellido).localeCompare(b.t.nombre + b.t.apellido);
      if (sortMode === "riesgo") return b.risk.score - a.risk.score;
      return b.ppp - a.ppp;
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

      <div className="flex gap-2">
        <div className="relative flex-1">
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
            className="w-full bg-card border border-ink/10 rounded-xl pl-10 pr-4 py-2.5 text-sm"
          />
        </div>
        {/* Selector de ordenamiento intuitivo */}
        <div className="relative shrink-0 flex items-center bg-card border border-ink/10 rounded-xl px-2.5 h-10 hover:border-ink/20 transition cursor-pointer">
          <svg className="w-3.5 h-3.5 text-ink/40 mr-1.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="21" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="3" y2="18" />
          </svg>
          <span className="text-xs text-ink/50 mr-1 hidden xs:inline">Ordenar:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-transparent text-xs font-semibold text-ink/75 hover:text-ink focus:outline-none pr-5 cursor-pointer appearance-none"
          >
            <option value="prioridad">Prioridad pastoral</option>
            <option value="riesgo">Nivel de riesgo</option>
            <option value="nombre">Nombre (A-Z)</option>
          </select>
          <svg className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Botón de recálculo intuitivo */}
        <button
          onClick={async () => {
            setPppRecalculating(true);
            await recalcPpp();
            setPppRecalculating(false);
          }}
          disabled={pppRecalculating}
          className="shrink-0 h-10 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-100 transition disabled:opacity-50 pressable"
          title="Actualizar y recalcular prioridades pastorales de los adolescentes"
        >
          <svg className={`w-3.5 h-3.5 ${pppRecalculating ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span className="hidden sm:inline">Actualizar</span>
        </button>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="relative shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-ink/10 bg-card text-ink/50 hover:text-ink/70 hover:bg-ink/5 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold text-white bg-teal-600 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { val: filtroFidelidad, label: filtroFidelidad !== "all" ? `Nivel: ${["", "Iniciado", "Fiel", "Líder", "Mentor"][filtroFidelidad as number]}` : null, onClear: () => setFiltroFidelidad("all") },
            { val: filtroPastoral, label: filtroPastoral !== "all" ? ({ 0: "Sin riesgo", 1: "Seguimiento", 2: "Atención", 3: "Urgente", 4: "Crítico", 5: "Crisis" } as Record<number, string>)[filtroPastoral] : null, onClear: () => setFiltroPastoral("all") },
            { val: filtroEdad, label: filtroEdad !== "all" ? `Edad: ${filtroEdad}` : null, onClear: () => setFiltroEdad("all") },
          ]
            .filter((x) => x.label)
            .map((x) => (
              <span key={x.label} className="inline-flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100 rounded-full pl-2.5 pr-1 py-1 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/40">
                {x.label}
                <button onClick={x.onClear} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-teal-200/60 transition">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          <button
            onClick={() => { setFiltroFidelidad("all"); setFiltroPastoral("all"); setFiltroEdad("all"); }}
            className="text-[11px] font-semibold text-ink/40 hover:text-ink/60 underline underline-offset-2"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Overlay de filtros */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 animate-overlay-in"
          onClick={() => setShowFilters(false)}
        />
      )}

      {/* Panel lateral de filtros (Drawer) */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-sm bg-card/95 dark:bg-card/98 shadow-2xl border-l border-ink/10 dark:border-white/5 z-50 p-4 sm:p-5 flex flex-col justify-between transition-transform duration-300 ease-out transform ${
          showFilters ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between pb-4 border-b border-ink/5 mb-4">
            <p className="text-sm font-bold text-ink flex items-center gap-1.5">
              <span>🎛️</span> Filtros de búsqueda
            </p>
            <button
              onClick={() => setShowFilters(false)}
              className="w-8 h-8 rounded-full bg-ink/5 hover:bg-ink/10 text-ink/50 hover:text-ink/80 flex items-center justify-center pressable"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            <div>
              <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-2">Fidelidad</p>
              <div className="flex flex-wrap gap-1.5">
                {(["all", 1, 2, 3, 4] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setFiltroFidelidad(v)}
                    className={`text-xs font-semibold rounded-full px-3 py-1.5 transition pressable ${
                      filtroFidelidad === v
                        ? "bg-teal-600 text-white"
                        : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                    }`}
                  >
                    {v === "all" ? "Todos" : ["", "Iniciado", "Fiel", "Líder", "Mentor"][v]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-2">Estado Pastoral</p>
              <div className="flex flex-wrap gap-1.5">
                {(["all", 0, 1, 2, 3, 4, 5] as const).map((v) => (
                  <button
                    key={String(v)}
                    onClick={() => setFiltroPastoral(v)}
                    className={`text-xs font-semibold rounded-full px-3 py-1.5 transition pressable ${
                      filtroPastoral === v
                        ? "bg-teal-600 text-white"
                        : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                    }`}
                  >
                    {v === "all" ? "Todos" : ({ 0: "Sin riesgo", 1: "Seguimiento", 2: "Atención", 3: "Urgente", 4: "Crítico", 5: "Crisis" } as Record<number, string>)[v]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-2">Grupo de Edad</p>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "12-13", "14-15", "16-17", "18+"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setFiltroEdad(v)}
                    className={`text-xs font-semibold rounded-full px-3 py-1.5 transition pressable ${
                      filtroEdad === v
                        ? "bg-teal-600 text-white"
                        : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                    }`}
                  >
                    {v === "all" ? "Todos" : v === "18+" ? "18+" : `${v} años`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-ink/5 flex gap-3 mt-4">
          <button
            onClick={() => {
              setFiltroFidelidad("all");
              setFiltroPastoral("all");
              setFiltroEdad("all");
            }}
            className="flex-1 bg-ink/5 hover:bg-ink/10 text-ink/60 rounded-xl py-2 text-xs font-semibold pressable"
          >
            Limpiar todo
          </button>
          <button
            onClick={() => setShowFilters(false)}
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2 text-xs font-semibold pressable"
          >
            Aplicar
          </button>
        </div>
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

      {teenData.length === 0 ? (
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
          {teenData.map(({ t, s, risk, age, game, rc, hasFollowUp, ppp }) => (
              <div
                key={t._id}
                onClick={() => onOpenProfile(t._id)}
                className="bg-card rounded-card shadow-soft p-4 cursor-pointer premium-card pressable"
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="rounded-full p-[2px]"
                      style={{ background: rc }}
                    >
                      <div className="bg-card rounded-full p-[2px]">
                        <Avatar teen={t} />
                      </div>
                    </div>
                    {risk.score >= 1 && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white"
                        style={{ background: rc }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {esc(t.nombre)} {esc(t.apellido)}
                    </p>
                    {(s.presentStreak > 2 || risk.score >= 2 || hasFollowUp) && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {s.presentStreak > 2 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-orange-50 text-orange-600 border border-orange-200/60 rounded-full px-1.5 py-0.5 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/40">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.8-2-1.83-2.37A4.5 4.5 0 008.5 6.5 4.5 4.5 0 006 11c-.1 1.37.57 2.5 1.5 3.5z" />
                              <path d="M12 22c-3.31 0-6-2.69-6-6 0-2.5 2-5 3.5-7C10 11 10 12 10 13c0 1.1.9 2 2 2s2-.9 2-2c0-1 0-2 1.5-4C16 11 18 13.5 18 16c0 3.31-2.69 6-6 6z" />
                            </svg>
                            Racha {s.presentStreak}
                          </span>
                        )}
                        {risk.score === 2 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            Atención
                          </span>
                        )}
                        {risk.score === 3 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-coral-50 text-coral-700 border border-coral-200 rounded-full px-1.5 py-0.5 dark:bg-orange-950/30 dark:text-coral-400 dark:border-coral-900/40">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            Urgente
                          </span>
                        )}
                        {risk.score >= 4 && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {risk.score === 4 ? "Crítico" : "Crisis"}
                          </span>
                        )}
                        {hasFollowUp && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-1.5 py-0.5 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 17a1 1 0 01-1-1c0-.4.2-.8.5-1.1L14 12" />
                              <path d="M19 9c.5 0 1 .2 1.4.6l3 3c.4.4.6.9.6 1.4" />
                              <path d="M5 15c-.5 0-1-.2-1.4-.6l-3-3c-.4-.4-.6-.9-.6-1.4" />
                              <path d="M22 9l-1-1-4-2" />
                              <path d="M2 9l1-1 4-2" />
                              <path d="M13 17l3 2 4-2" />
                              <path d="M5 15l-3 2 4 2" />
                              <path d="M5 17l-1 1" />
                              <path d="M19 9l-4-6h-3" />
                            </svg>
                            Seguimiento
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-ink/40 flex items-center gap-2 mt-1">
                      {age !== null ? age + " años" : "—"}
                      {s.total > 0 && (
                        <span className="text-[10px] font-semibold text-ink/30 bg-ink/5 rounded-full px-1.5 py-0.5">
                          Niv.{game.level.level}
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                        ppp >= 0.7
                          ? "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30"
                          : ppp >= 0.5
                          ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30"
                          : ppp >= 0.3
                          ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30"
                          : "bg-green-50 text-green-700 border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30"
                      }`}>
                        PPP {pppLabel(ppp)}
                      </span>
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
          ))}
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
