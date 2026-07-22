import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { VULNERABILITY_TAGS } from "../lib/types";
import { statsFor, riskScore, fmtDate, esc } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";
import { Avatar } from "./Layout";

interface AiPanelProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

const riskColors: Record<string, string> = {
  low: "text-green-700 bg-green-50 border-green-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  high: "text-red-700 bg-red-50 border-red-200",
};

const barColors: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-amber-500",
  high: "bg-red-600",
};

export default function AiPanel({ teens, attendanceMap, onOpenProfile, embedded = false }: AiPanelProps & { embedded?: boolean }) {
  const { token } = useAuth();
  const { scope } = useScope();
  const scopeArgs = { campusId: scope.campusId as any, ministryId: scope.ministryId as any, groupId: scope.groupId as any };
  const allAnalyses = useQuery(api.ai.getAllAnalyses, token ? { token, ...scopeArgs } : "skip") ?? [];
  const allJournal = useQuery(api.journal.listAll, token ? { token, ...scopeArgs } : "skip") ?? [];

  // Queries y mutations de persistencia en base de datos
  const latestWeeklySummaryFromDb = useQuery(api.ai.getLatestWeeklySummary);
  const saveWeeklySummary = useMutation(api.ai.storeWeeklySummary);

  const recommendationsFromDb = useQuery(api.ai.getActivityRecommendations);
  const saveRecommendations = useMutation(api.ai.storeActivityRecommendations);
  const updateRecStatusDb = useMutation(api.ai.updateRecommendationStatus);

  const generateSummary = useAction(api.ai.generateWeeklySummary as any);
  const generateRecommendations = useAction(api.ai.generateActivityRecommendations as any);
  const [weeklySummary, setWeeklySummary] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [recsLoading, setRecsLoading] = useState(false);

  const tagCounts: Record<string, number> = {};
  let riskDist = { low: 0, medium: 0, high: 0 };
  for (const a of allAnalyses as any[]) {
    for (const tag of a.vulnerabilityTags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    if (a.riskLevel in riskDist) riskDist[a.riskLevel as keyof typeof riskDist]++;
  }
  const total = (allAnalyses as any[]).length;
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  const highRiskTeensMap = new Map<string, number>();
  for (const a of allAnalyses as any[]) {
    if (a.riskLevel === "high") {
      highRiskTeensMap.set(a.teenId, (highRiskTeensMap.get(a.teenId) || 0) + 1);
    }
  }
  const highRiskTeens = teens
    .map((t) => ({
      teen: t,
      riskScore: riskScore(statsFor(t._id, attendanceMap)),
      alerts: highRiskTeensMap.get(t._id) || 0,
    }))
    .filter((x) => x.alerts > 0)
    .sort((a, b) => b.alerts - a.alerts);

  const handleGenerateSummary = async () => {
    setGenerating(true);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const recentEntries = (allJournal as any[])
      .filter((e: any) => e.entryDate >= sevenDaysAgo)
      .slice(0, 50)
      .map((e: any) => ({ content: e.content, category: e.category, entryDate: e.entryDate }));
    if (recentEntries.length === 0) {
      setWeeklySummary({ error: "No hay entradas esta semana" });
      setGenerating(false);
      return;
    }
    try {
      const result: any = await generateSummary({ entries: recentEntries });
      if (result && result.success && result.summary) {
        await saveWeeklySummary({
          totalEntries: result.summary.totalEntries,
          mainConcerns: result.summary.mainConcerns,
          emotionalClimate: result.summary.emotionalClimate,
          riskDistribution: result.summary.riskDistribution || { low: 0, medium: 0, high: 0 },
          topTags: result.summary.topTags || [],
          recommendation: result.summary.recommendation,
          modelUsed: result.modelUsed,
        });
        setWeeklySummary(null);
      } else {
        setWeeklySummary(result);
      }
    } catch (err: any) {
      setWeeklySummary({ error: "Fallo al generar el resumen: " + err.message });
    }
    setGenerating(false);
  };

  return (
    <div className="space-y-5">
      {!embedded && <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Inteligencia Pastoral
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">
          Asistente IA
        </h1>
      </div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Entradas analizadas" value={total} icon="analytics" />
        <StatCard label="Alto riesgo" value={riskDist.high} icon="critical" />
        <StatCard label="Medio riesgo" value={riskDist.medium} icon="warning" />
        <StatCard label="Bajo riesgo" value={riskDist.low} icon="safe" />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-card shadow-soft p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Distribución de riesgo
          </h2>
          {total === 0 ? (
            <p className="text-sm text-ink/40 text-center py-6">
              Aún no hay análisis. Escribe bitácoras para activar la IA.
            </p>
          ) : (
            <div className="space-y-3">
              {(["high", "medium", "low"] as const).map((level) => {
                const count = riskDist[level];
                const pct = total ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="w-16 text-xs font-semibold text-ink/60 capitalize">{level === "high" ? "Alto" : level === "medium" ? "Medio" : "Bajo"}</span>
                    <div className="flex-1 h-5 bg-ink/5 rounded-full overflow-hidden">
                      <div className={`h-full ${barColors[level]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs font-semibold text-ink/70">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card rounded-card shadow-soft p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Temas detectados
          </h2>
          {sortedTags.length === 0 ? (
            <p className="text-sm text-ink/40 text-center py-6">Sin datos todavía</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedTags.map(([tag, count]) => {
                const meta = VULNERABILITY_TAGS.find((t) => t.id === tag);
                return (
                  <span key={tag} className="inline-flex items-center gap-1 text-xs font-semibold bg-ink/5 text-ink/60 rounded-full px-2.5 py-1.5">
                    {meta ? `${meta.icon} ${meta.label}` : tag}
                    <span className="ml-1 w-5 h-5 rounded-full bg-ink/10 flex items-center justify-center text-[10px]">{count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-card shadow-soft p-5">
        <div className="flex items-start sm:items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base">
            Adolescentes en alto riesgo
          </h2>
          <span className="text-xs text-ink/40">{highRiskTeens.length} adolescentes</span>
        </div>
        {highRiskTeens.length === 0 ? (
          <p className="text-sm text-ink/40 text-center py-4">No hay adolescentes en alto riesgo</p>
        ) : (
          <div className="space-y-2.5">
            {highRiskTeens.slice(0, 10).map(({ teen, riskScore: rs, alerts }) => (
              <div
                key={teen._id}
                onClick={() => onOpenProfile(teen._id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-red-100 bg-red-50/50 cursor-pointer hover:bg-red-50 transition"
              >
                <Avatar teen={teen} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {esc(teen.nombre)} {esc(teen.apellido)}
                  </p>
                  <p className="text-xs text-ink/50">
                    {alerts} alerta{alerts > 1 ? "s" : ""} de IA · Score pastoral: {rs.score}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">🔴</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-card shadow-soft p-5">
        <div className="flex items-start sm:items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base">
            Resumen ejecutivo semanal
          </h2>
          <button
            onClick={handleGenerateSummary}
            disabled={generating}
            className="text-xs font-semibold bg-ink text-white rounded-full px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            {generating ? (
              <>Generando...</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
                Generar resumen
              </>
            )}
          </button>
        </div>
        {(() => {
          const displaySummary = weeklySummary || (latestWeeklySummaryFromDb ? { success: true, summary: latestWeeklySummaryFromDb, modelUsed: latestWeeklySummaryFromDb.modelUsed } : null);
          
          if (generating) {
            return <p className="text-sm text-ink/40 text-center py-6">Generando resumen ejecutivo con IA...</p>;
          }
          if (!displaySummary) {
            return (
              <p className="text-sm text-ink/40 text-center py-6">
                Presiona "Generar resumen" para obtener un análisis semanal de las bitácoras.
              </p>
            );
          }
          if (displaySummary.error) {
            return <p className="text-sm text-ink/40 text-center py-4">{displaySummary.error}</p>;
          }
          if (displaySummary.success && displaySummary.summary) {
            return (
              <div className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <span className="text-ink/60">Total entradas: <strong className="text-ink">{displaySummary.summary.totalEntries}</strong></span>
                  {displaySummary.summary.generatedAt && (
                    <span className="text-ink/40 text-[10px] self-center">Generado el: {new Date(displaySummary.summary.generatedAt).toLocaleDateString()}</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">Principales preocupaciones</p>
                  <p className="text-sm text-ink/80">{displaySummary.summary.mainConcerns}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">Clima emocional</p>
                  <p className="text-sm text-ink/80">{displaySummary.summary.emotionalClimate}</p>
                </div>
                {displaySummary.summary.topTags && displaySummary.summary.topTags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">Temas principales</p>
                    <div className="flex flex-wrap gap-1.5">
                      {displaySummary.summary.topTags.map((tag: string) => (
                        <span key={tag} className="text-xs font-medium bg-ink/5 text-ink/60 px-2 py-1 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">Recomendación</p>
                  <p className="text-sm text-ink/80 font-medium">{displaySummary.summary.recommendation}</p>
                </div>
                <p className="text-[10px] text-ink/30">Modelo: {displaySummary.modelUsed}</p>
              </div>
            );
          }
          return <p className="text-sm text-ink/40 text-center py-4">Error al generar resumen. Intenta de nuevo.</p>;
        })()}
      </div>

      <div className="bg-card rounded-card shadow-soft p-5">
        <div className="flex items-start sm:items-center justify-between mb-4 gap-2 flex-wrap">
          <h2 className="font-display font-semibold text-base">
            Recomendaciones de actividades
          </h2>
          <button
            onClick={async () => {
              setRecsLoading(true);
              try {
                const result: any = await generateRecommendations({
                  token: token ?? undefined,
                  activeScope: {
                    campusId: scope.campusId,
                    ministryId: scope.ministryId,
                    groupId: scope.groupId,
                  },
                });
                if (result && result.success && result.recommendations) {
                  await saveRecommendations({
                    recommendations: result.recommendations.map((r: any) => ({
                      title: r.title,
                      type: r.type,
                      description: r.description,
                      bibleVerse: r.bibleVerse,
                      targetTags: r.targetTags,
                      urgency: r.urgency,
                    })),
                    modelUsed: result.modelUsed,
                  });
                  setRecommendations(null);
                } else {
                  setRecommendations(result);
                }
              } catch (err: any) {
                setRecommendations({ error: "Fallo al generar recomendaciones: " + err.message });
              }
              setRecsLoading(false);
            }}
            disabled={recsLoading}
            className="text-xs font-semibold bg-teal-600 text-white rounded-full px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            {recsLoading ? (
              <>Generando...</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
                  <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" />
                  <path d="M6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14z" />
                </svg>
                Generar
              </>
            )}
          </button>
        </div>
        {(() => {
          const displayRecommendations = recommendationsFromDb && recommendationsFromDb.length > 0
            ? { success: true, recommendations: recommendationsFromDb, modelUsed: recommendationsFromDb[0]?.modelUsed }
            : recommendations;

          if (recsLoading) {
            return <p className="text-sm text-ink/40 text-center py-6">Generando recomendaciones con IA...</p>;
          }
          if (!displayRecommendations) {
            return (
              <p className="text-sm text-ink/40 text-center py-6">
                Genera recomendaciones de talleres, estudios y actividades basadas en las vulnerabilidades detectadas.
              </p>
            );
          }
          if (displayRecommendations.error) {
            return <p className="text-sm text-ink/40 text-center py-4">{displayRecommendations.error}</p>;
          }
          if (displayRecommendations.success && displayRecommendations.recommendations) {
            return (
              <div className="space-y-3">
                {displayRecommendations.recommendations.map((r: any) => (
                  <div key={r._id || r.title} className={`p-4 rounded-xl border space-y-2 ${
                    r.status === "implemented" ? "border-green-200 bg-green-50/50" : r.status === "dismissed" ? "border-ink/5 bg-ink/[0.01] opacity-50" : "border-ink/10 bg-ink/[0.02]"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{r.title}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        r.urgency === "alta" ? "bg-red-50 text-red-600" : r.urgency === "media" ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"
                      }`}>
                        {r.urgency === "alta" ? "🔴" : r.urgency === "media" ? "🟡" : "🟢"} {r.urgency}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      {r.type}
                    </span>
                    <p className="text-sm text-ink/70">{r.description}</p>
                    {r.bibleVerse && (
                      <p className="text-xs text-ink/40 font-medium">
                        📖 {r.bibleVerse}
                      </p>
                    )}
                    {r.targetTags && r.targetTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.targetTags.map((tag: string) => (
                          <span key={tag} className="text-[10px] font-medium bg-ink/5 text-ink/50 px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(r.status || "pending") === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => updateRecStatusDb({ id: r._id, status: "implemented" })}
                          className="text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded-full transition"
                        >
                          ✓ Implementado
                        </button>
                        <button
                          onClick={() => updateRecStatusDb({ id: r._id, status: "dismissed" })}
                          className="text-[10px] font-semibold text-ink/40 hover:text-coral-600 bg-ink/5 hover:bg-coral-50 px-2.5 py-1 rounded-full transition"
                        >
                          Descartar
                        </button>
                      </div>
                    )}
                    {r.status === "implemented" && (
                      <p className="text-[10px] font-semibold text-green-600">✓ Implementado</p>
                    )}
                    {r.status === "dismissed" && (
                      <p className="text-[10px] font-semibold text-ink/30">Descartado</p>
                    )}
                  </div>
                ))}
                <p className="text-[10px] text-ink/30">Modelo: {displayRecommendations.modelUsed}</p>
              </div>
            );
          }
          return <p className="text-sm text-ink/40 text-center py-4">Error al generar recomendaciones. Intenta de nuevo.</p>;
        })()}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  const icons: Record<string, string> = {
    analytics: `<path d="M3 17l5-5 4 4 6-6" /><path d="M3 21h18" /><path d="M19 3v6" /><path d="M16 6h6" />`,
    critical: `<path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />`,
    warning: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />`,
    safe: `<path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />`,
  };
  const colorMap: Record<string, string> = {
    analytics: "text-ink bg-ink/5",
    critical: "text-red-600 bg-red-50",
    warning: "text-amber-600 bg-amber-50",
    safe: "text-green-600 bg-green-50",
  };
  return (
    <div className="bg-card rounded-card shadow-soft p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[icon] || ""}`}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icons[icon] || "" }} />
      </div>
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="text-xs text-ink/45 mt-1">{label}</p>
    </div>
  );
}
