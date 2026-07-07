import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, RiskInfo } from "../lib/types";
import {
  greeting,
  fmtDateShort,
  statsFor,
  riskScore,
  esc,
  streakTier,
  fmtDate,
} from "../lib/utils";
import { Avatar } from "./Layout";
import { fill } from "../lib/templates";
import { useTemplates } from "../hooks/useTemplates";
import WhatsAppModal from "./WhatsAppModal";
import { useAuth } from "../hooks/useAuth";
import Modal from "./Modal";

function roleTitle(role: string | undefined): string {
  switch (role) {
    case "pastor": return "Pastor";
    case "director": return "Director";
    case "coordinador": return "Coordinador";
    case "leader": return "Líder";
    case "helper": return "Ayudante";
    default: return "Líder";
  }
}

function severityLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    critical: "Crítica",
  };
  return labels[value || ""] || "Crítica";
}

function statusLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    unattended: "Abierta",
    open: "Abierta",
    in_progress: "En proceso",
    attended: "Atendida",
    referred: "Derivada",
    follow_up: "Seguimiento",
  };
  return labels[value || ""] || "Abierta";
}

function taskStatusLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    in_progress: "En proceso",
    done: "Realizado",
    rescheduled: "Reprogramado",
    canceled: "Cancelado",
    escalated: "Escalado",
  };
  return labels[value || ""] || "Pendiente";
}

interface DashboardProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

function RoleDashboardSummary({ summary, onOpenProfile }: { summary: any; onOpenProfile: (id: string) => void }) {
  const variantLabels: Record<string, string> = {
    pastor: "Salud general del ministerio",
    coordinador: "Estado de tus grupos",
    leader: "Mis adolescentes y seguimientos",
  };
  const m = summary.metrics;
  const cards =
    summary.variant === "pastor"
      ? [
          ["Asistencia total", `${m.attendancePct}%`],
          ["Retención nuevos/visitantes", `${m.newTeens + m.visitors}`],
          ["Adolescentes en riesgo", `${summary.needsContact.length}`],
          ["Líderes con tareas", `${m.leadersWithTasks}`],
        ]
      : summary.variant === "coordinador"
      ? [
          ["Adolescentes sin contacto", `${summary.needsContact.length}`],
          ["Asistencia por grupo", `${m.attendancePct}%`],
          ["Alertas pendientes", `${m.pendingCrisis}`],
          ["Tareas vencidas", `${m.overdueTasks}`],
        ]
      : [
          ["Mis adolescentes", `${m.totalTeens}`],
          ["Asistencia reciente", `${m.attendancePct}%`],
          ["Tareas pastorales", `${m.openTasks}`],
          ["Nuevos visitantes", `${m.visitors}`],
        ];
  return (
    <section className="rounded-card border border-ink/10 bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{variantLabels[summary.variant] || variantLabels.leader}</p>
          <p className="text-sm text-ink/50">Dashboard filtrado por rol y alcance autorizado.</p>
        </div>
        {m.criticalCrisis > 0 && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 border border-red-100">
            {m.criticalCrisis} crisis crítica
          </span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-3">
            <p className="text-[11px] font-semibold text-ink/45">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      {summary.needsContact.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-ink">Adolescentes que necesitan contacto esta semana</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {summary.needsContact.slice(0, 4).map((item: any) => (
              <button
                key={String(item.teenId)}
                type="button"
                onClick={() => onOpenProfile(String(item.teenId))}
                className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-left"
              >
                <span className="block text-sm font-semibold text-amber-900">{item.teenName}</span>
                <span className="block text-xs text-amber-700">{item.reasons.join(" · ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {summary.groupHealth?.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-bold text-ink">Salud por grupo</p>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {summary.groupHealth.slice(0, 4).map((group: any) => (
              <div key={String(group.groupId)} className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{esc(group.groupName)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${group.healthScore < 55 ? "bg-red-50 text-red-700" : group.healthScore < 75 ? "bg-amber-50 text-amber-700" : "bg-teal-50 text-teal-700"}`}>
                    {group.healthScore}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/50">
                  {group.teens} adolescentes · Asist. {group.attendancePct}% · Plan {group.planCoverage}%
                </p>
                <p className="mt-1 text-xs text-ink/45">
                  {group.needsContact} contacto · {group.openTasks} tareas · {group.pendingCrisis} crisis
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function Dashboard({
  teens,
  attendanceMap,
  onOpenProfile,
}: DashboardProps) {
  const { user, token } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "";
  const title = roleTitle(user?.role);
  const dates = Object.keys(attendanceMap).sort();
  const currentWeek = dates[dates.length - 1];
  const all = teens.map((t) => ({ t, s: statsFor(t._id, attendanceMap) }));
  const avgPct = all.length
    ? Math.round(all.reduce((a, x) => a + x.s.pct, 0) / all.length)
    : 0;
  const weekPresent = currentWeek
    ? Object.values(attendanceMap[currentWeek] || {}).filter(
        (v) => v === "present"
      ).length
    : 0;
  const weekTotal = currentWeek
    ? Object.keys(attendanceMap[currentWeek] || {}).length
    : 0;

  const alerts = all
    .map((x) => ({ ...x, risk: riskScore(x.s) }))
    .filter((x) => x.risk.score >= 1)
    .sort((a, b) => b.risk.score - a.risk.score);

  const allFollowUps = useQuery(api.journal.listFollowUps) ?? [];
  const latestFollowUps = teens
    .map((t) => {
      const teenEntries = allFollowUps.filter((e) => e.teenId === t._id);
      if (teenEntries.length === 0) return null;
      return { teen: t, entry: teenEntries[0] };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const streaks = all
    .filter((x) => x.s.presentStreak >= 3)
    .sort((a, b) => b.s.presentStreak - a.s.presentStreak);

  const trendDates = dates.slice(-8);
  const trend = trendDates.map((d) => {
    const vals = Object.values(attendanceMap[d] || {});
    const tot = vals.length;
    const pres = vals.filter((v) => v === "present").length;
    return { d, pct: tot ? Math.round((pres / tot) * 100) : 0 };
  });

  const crisisAlertsRaw = useQuery(api.crisis.getUnattendedAlerts, token ? { token } : {}) ?? [];
  const roleSummary = useQuery(api.dashboard.getRoleSummary, token ? { token } : "skip") as any;
  const pastoralTasks = useQuery(api.pastoralTasks.listOpenForDashboard, token ? { token } : "skip") ?? [];
  const updateCrisisStatus = useMutation(api.crisis.updateStatus);
  const reviewCrisisAlert = useMutation(api.crisis.reviewAlert);
  const dropoutPredictions = useQuery(api.ai.getAllDropoutPredictions) ?? [];
  const [crisisStatusDraft, setCrisisStatusDraft] = useState<{
    alertId: any;
    status: "attended" | "referred" | "follow_up";
    notes: string;
  } | null>(null);
  const [crisisReviewDraft, setCrisisReviewDraft] = useState<{
    alertId: any;
    finalSeverity: "low" | "medium" | "high" | "critical";
    notes: string;
  } | null>(null);

  const highDropout = (dropoutPredictions as any[])
    .filter((d: any) => d.riskLevel === "high")
    .map((d: any) => {
      const teen = teens.find((t) => t._id === d.teenId);
      return teen ? { teen, prediction: d } : null;
    })
    .filter((x: any): x is NonNullable<typeof x> => x !== null)
    .sort((a: any, b: any) => b.prediction.probability - a.prediction.probability);

  const crisisTeens = crisisAlertsRaw
    .map((alert: any) => {
      const teen = teens.find((t) => t._id === alert.teenId);
      if (!teen) return null;
      return { teen, alert };
    })
    .filter((x: any): x is NonNullable<typeof x> => x !== null);

  const changeCrisisStatus = async (alertId: any, nextStatus: "in_progress" | "attended" | "referred" | "follow_up") => {
    if (!token) return;
    if (nextStatus === "in_progress") {
      await updateCrisisStatus({ token, alertId, status: nextStatus });
      return;
    }
    setCrisisStatusDraft({ alertId, status: nextStatus, notes: "" });
  };

  const reviewAlert = async (alert: any) => {
    if (!token) return;
    const suggestedRaw = alert.aiSuggestedSeverity || alert.severity || "medium";
    const suggested = (["low", "medium", "high", "critical"].includes(suggestedRaw) ? suggestedRaw : "medium") as "low" | "medium" | "high" | "critical";
    setCrisisReviewDraft({ alertId: alert._id, finalSeverity: suggested, notes: "" });
  };

  const colorMap: Record<string, string> = {
    ink: "text-ink bg-ink/5 dark:text-ink/80 dark:bg-ink/10",
    teal: "text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/35 dark:border dark:border-teal-900/30",
    sage: "text-sage-600 bg-sage-50 dark:text-sage-400 dark:bg-sage-950/35 dark:border dark:border-sage-900/30",
    coral: "text-coral-600 bg-coral-50 dark:text-coral-400 dark:bg-coral-950/35 dark:border dark:border-coral-900/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          {greeting()}{firstName ? `, ${title} ${firstName}` : ""}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mt-0.5">
          Resumen del ministerio
        </h1>
      </div>

      {roleSummary && (
        <RoleDashboardSummary summary={roleSummary} onOpenProfile={onOpenProfile} />
      )}

      {crisisTeens.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🚨</span>
            <h2 className="font-display font-bold text-sm text-red-800">
              Alertas de crisis ({crisisTeens.length})
            </h2>
          </div>
          <div className="space-y-2">
            {crisisTeens.map((c) => (
              <div
                key={c.teen._id}
                className="flex flex-col items-stretch gap-3 p-3 rounded-xl bg-white/60 border border-red-100 sm:flex-row sm:items-center"
              >
                <div className="cursor-pointer flex items-center gap-3 flex-1 min-w-0" onClick={() => onOpenProfile(c.teen._id)}>
                  <Avatar teen={c.teen} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {esc(c.teen.nombre)} {esc(c.teen.apellido)}
                    </p>
                    <p className="text-xs text-red-600/80 truncate">{c.alert.summary}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
                  <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-1 rounded-full">
                    {severityLabel(c.alert.severity)} · {statusLabel(c.alert.status)}
                  </span>
                  {c.alert.humanReviewRequired !== false && (
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-full">
                      Revisión humana pendiente
                    </span>
                  )}
                  <button
                    onClick={() => reviewAlert(c.alert)}
                    className="text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded-full transition"
                  >
                    Revisar IA
                  </button>
                  <button
                    onClick={() => changeCrisisStatus(c.alert._id, "in_progress")}
                    className="text-[10px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-full transition"
                  >
                    En proceso
                  </button>
                  <button
                    onClick={() => changeCrisisStatus(c.alert._id, "attended")}
                    className="text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-1 rounded-full transition"
                  >
                    Atendida
                  </button>
                  <button
                    onClick={() => changeCrisisStatus(c.alert._id, "referred")}
                    className="text-[10px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-full transition"
                  >
                    Derivar
                  </button>
                  <button
                    onClick={() => changeCrisisStatus(c.alert._id, "follow_up")}
                    className="text-[10px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-1 rounded-full transition"
                  >
                    Seguimiento
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {highDropout.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚠️</span>
            <h2 className="font-display font-bold text-sm text-amber-800">
              Riesgo de abandono ({highDropout.length} teen{highDropout.length > 1 ? "s" : ""})
            </h2>
          </div>
          <div className="space-y-2">
            {highDropout.slice(0, 5).map((c: any) => (
              <div
                key={c.teen._id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/60 border border-amber-100 cursor-pointer hover:bg-white transition"
                onClick={() => onOpenProfile(c.teen._id)}
              >
                <Avatar teen={c.teen} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {esc(c.teen.nombre)} {esc(c.teen.apellido)}
                  </p>
                  <p className="text-xs text-amber-700/80 truncate">{c.prediction.primaryFactor}</p>
                </div>
                 <div className="text-right shrink-0 self-start sm:self-center">
                  <span className="text-sm font-bold text-amber-800">{c.prediction.probability}%</span>
                  <p className="text-[10px] text-amber-600">probabilidad</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-6 gap-3">
        <StatCard
          label="Adolescentes"
          value={teens.length}
          icon="users"
          color="ink"
          colorMap={colorMap}
        />
        <StatCard
          label="Asistencia promedio"
          value={avgPct + "%"}
          icon="check"
          color="teal"
          colorMap={colorMap}
        />
        <StatCard
          label="Esta semana"
          value={weekTotal ? `${weekPresent}/${weekTotal}` : "—"}
          icon="home"
          color="sage"
          colorMap={colorMap}
        />
        <StatCard
          label="Seguimientos"
          value={latestFollowUps.length}
          icon="alert"
          color={latestFollowUps.length ? "coral" : "ink"}
          colorMap={colorMap}
        />
      </div>

      <div className="grid lg:grid-cols-3 2xl:grid-cols-4 gap-5">
        <div className="lg:col-span-3 2xl:col-span-4 bg-card rounded-card shadow-soft p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="font-display font-semibold text-base">
              Tareas pastorales pendientes
            </h2>
            <span className="text-xs text-ink/40">
              {pastoralTasks.length} abierta{pastoralTasks.length === 1 ? "" : "s"}
            </span>
          </div>
          {pastoralTasks.length === 0 ? (
            <EmptyState
              title="Sin tareas abiertas"
              sub="Las tareas creadas desde el perfil, plan pastoral o crisis aparecerán aquí."
            />
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pastoralTasks.slice(0, 9).map((task: any) => (
                <div
                  key={task._id}
                  className="p-3 rounded-xl border border-ink/10 bg-ink/[0.02] cursor-pointer hover:bg-ink/[0.04] transition"
                  onClick={() => onOpenProfile(task.teenId)}
                >
                  <div className="flex items-start gap-3">
                    {task.teenPhoto ? (
                      <img src={task.teenPhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-xs font-bold">
                        {String(task.teenName || "A").slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{esc(task.teenName)}</p>
                      <p className="text-xs text-ink/70 truncate">{esc(task.title)}</p>
                      <p className="text-[11px] text-ink/40 mt-1">
                        {task.assignedName || "Sin responsable"} · {task.dueDate ? fmtDate(task.dueDate) : "Sin fecha"} · {taskStatusLabel(task.status)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${task.priority === "critical" ? "bg-red-100 text-red-700" : task.priority === "high" ? "bg-coral-50 text-coral-700" : task.priority === "medium" ? "bg-amber-50 text-amber-700" : "bg-ink/5 text-ink/50"}`}>
                      {severityLabel(task.priority)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-card rounded-card shadow-soft p-3 sm:p-5 overflow-hidden">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="font-display font-semibold text-base">
              Seguimiento pastoral
            </h2>
            <span className="text-xs text-ink/40">
              {alerts.length + latestFollowUps.length} pendiente{alerts.length + latestFollowUps.length === 1 ? "" : "s"}
            </span>
          </div>

          {latestFollowUps.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-coral-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <span>📌</span> Requieren seguimiento
              </p>
              <div className="space-y-2.5 mb-4">
                {latestFollowUps.map((f) => (
                  <FollowUpRow
                    key={f.teen._id}
                    teen={f.teen}
                    entry={f.entry}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </div>
            </>
          )}

          {alerts.length > 0 && (
            <>
              {latestFollowUps.length > 0 && (
                <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <span>⚠️</span> Alertas de asistencia
                </p>
              )}
              <div className="space-y-2.5">
                {alerts.map((a) => (
                  <AlertRow
                    key={a.t._id}
                    teen={a.t}
                    risk={a.risk}
                    stats={a.s}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </div>
            </>
          )}

          {alerts.length === 0 && latestFollowUps.length === 0 && (
            <EmptyState
              title="Todo al día"
              sub="No hay alertas de asistencia ni seguimientos pendientes. Buen trabajo pastoreando esta semana."
            />
          )}
        </div>

        <div className="bg-card rounded-card shadow-soft p-3 sm:p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Rachas activas
          </h2>
          {streaks.length === 0 ? (
            <EmptyState
              title="Aún sin rachas"
              sub="Cuando un adolescente asista 3 semanas seguidas aparecerá aquí."
            />
          ) : (
            <div className="space-y-3">
              {streaks.slice(0, 6).map((s) => (
                <div
                  key={s.t._id}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => onOpenProfile(s.t._id)}
                >
                  <Avatar teen={s.t} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {esc(s.t.nombre)} {esc(s.t.apellido)}
                    </p>
                    <p className="text-xs text-ink/45">{s.s.pct}% de asistencia</p>
                  </div>
                  <span className="chip text-xs font-semibold text-amber-600 flex items-center gap-1">
                    {streakTier(s.s.presentStreak)?.icon ?? <FlameIcon />}
                    {s.s.presentStreak}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-card shadow-soft p-4 sm:p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Distribución de riesgo pastoral
          </h2>
          {(() => {
            const dist = all.map((x) => riskScore(x.s));
            const distCounts = [0, 1, 2, 3, 4, 5].map((s) => dist.filter((r) => r.score === s).length);
            const labels = ["Sin riesgo", "Seguimiento", "Atención", "Urgente", "Crítico", "Crisis"];
            const colors = ["#6B7280", "#0B7285", "#F0A33C", "#E8590C", "#DC2626", "#DC2626"];
            const barColors = ["bg-slate-400", "bg-teal-600", "bg-amber-500", "bg-coral-500", "bg-red-600", "bg-red-700"];
            return (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="grid grid-cols-1 gap-1 sm:grid-cols-[6rem_minmax(0,1fr)_1.5rem] sm:items-center sm:gap-3">
                    <span className="text-xs text-ink/60 shrink-0">{labels[s]}</span>
                    <div className="flex-1 h-5 bg-ink/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColors[s]} rounded-full transition-all`}
                        style={{ width: `${all.length ? (distCounts[s] / all.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-semibold text-ink/70">{distCounts[s]}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="bg-card rounded-card shadow-soft p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-5">
          <h2 className="font-display font-semibold text-base">
            Tendencia de asistencia
          </h2>
          <span className="text-xs text-ink/40">
            Últimas {trend.length} semanas
          </span>
        </div>
        {trend.length === 0 ? (
          <EmptyState
            title="Sin datos todavía"
            sub="Marca la primera asistencia para ver la tendencia aquí."
          />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex items-end gap-2 h-36 min-w-[20rem] sm:min-w-0">
              {trend.map((p, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-2 group"
                >
                  <div className="w-full flex items-end h-28 rounded-md bg-ink/[0.04] overflow-hidden relative">
                    <div
                      className="w-full bg-gradient-to-t from-teal-600/60 to-teal-500 group-hover:from-teal-600 group-hover:to-teal-400 transition-all rounded-t-md"
                      style={{ height: `${p.pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-ink/40">
                    {fmtDateShort(p.d)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {crisisStatusDraft && (
        <Modal title="Registrar decisión de crisis" onClose={() => setCrisisStatusDraft(null)}>
          <div className="p-5 space-y-4">
            <p className="text-sm text-ink/60">
              Esta acción requiere una nota para mantener trazabilidad pastoral.
            </p>
            <textarea
              value={crisisStatusDraft.notes}
              onChange={(event) => setCrisisStatusDraft({ ...crisisStatusDraft, notes: event.target.value })}
              rows={4}
              autoFocus
              placeholder="Describe la decisión o el seguimiento realizado..."
              className="w-full resize-none rounded-xl border border-ink/10 bg-card px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setCrisisStatusDraft(null)} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 hover:bg-ink/5 transition">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!token || !crisisStatusDraft.notes.trim()) return;
                  await updateCrisisStatus({ token, alertId: crisisStatusDraft.alertId, status: crisisStatusDraft.status, notes: crisisStatusDraft.notes.trim() });
                  setCrisisStatusDraft(null);
                }}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition pressable"
              >
                Guardar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {crisisReviewDraft && (
        <Modal title="Revisión humana de IA" onClose={() => setCrisisReviewDraft(null)}>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-ink/45 uppercase mb-2">Nivel final</p>
              <div className="flex flex-wrap gap-2">
                {(["low", "medium", "high", "critical"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCrisisReviewDraft({ ...crisisReviewDraft, finalSeverity: level })}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      crisisReviewDraft.finalSeverity === level ? "bg-teal-600 text-white" : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                    }`}
                  >
                    {severityLabel(level)}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={crisisReviewDraft.notes}
              onChange={(event) => setCrisisReviewDraft({ ...crisisReviewDraft, notes: event.target.value })}
              rows={4}
              placeholder="Nota de revisión humana..."
              className="w-full resize-none rounded-xl border border-ink/10 bg-card px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setCrisisReviewDraft(null)} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 hover:bg-ink/5 transition">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!token || !crisisReviewDraft.notes.trim()) return;
                  await reviewCrisisAlert({ token, alertId: crisisReviewDraft.alertId, finalSeverity: crisisReviewDraft.finalSeverity, notes: crisisReviewDraft.notes.trim() });
                  setCrisisReviewDraft(null);
                }}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition pressable"
              >
                Guardar revisión
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  colorMap,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  colorMap: Record<string, string>;
}) {
  const icons: Record<string, string> = {
    home: `<path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1v-9"/>`,
    check: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8.5 14.5l2 2 4-4"/>`,
    users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3"/>`,
    alert: `<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>`,
  };
  return (
    <div className="bg-card rounded-card shadow-soft p-4">
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

function AlertRow({
  teen,
  risk: r,
  stats: s,
  onOpenProfile,
}: {
  teen: Doc<"teens">;
  risk: RiskInfo;
  stats: ReturnType<typeof statsFor>;
  onOpenProfile: (id: string) => void;
}) {
  const [showWA, setShowWA] = useState(false);
  const { templates } = useTemplates();
  const vars = {
    nombre: teen.nombre,
    apellido: teen.apellido,
    racha: s.presentStreak,
    faltas: s.consecutiveAbsences,
    telefonoPadre: teen.telefonoPadre || "",
  };
  const alertTemplates = templates
    .filter((t) => t.category === "absence")
    .map((t) => ({ ...t, text: fill(t.text, vars) }));
  const colorMap: Record<string, string> = {
    gray: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-950/30 dark:border-slate-800/60 dark:text-slate-400",
    teal: "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:border-teal-900/40 dark:text-teal-400",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400",
    coral: "bg-coral-50 text-coral-600 border-coral-100 dark:bg-orange-950/30 dark:border-orange-900/40 dark:text-orange-400",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400",
  };

  const hasPhone = !!(teen.telefono || teen.telefonoPadre);

  return (
    <>
      {/* Layout de 2 líneas en móvil para evitar overflow */}
      <div
        className={`rounded-xl border overflow-hidden ${colorMap[r.color]} ${hasPhone ? "" : "cursor-pointer"}`}
        onClick={() => !hasPhone && onOpenProfile(teen._id)}
      >
        {/* Fila superior: avatar + nombre + descripción */}
        <div className="flex items-start gap-2.5 px-3 pt-3 pb-2">
          <div className="shrink-0">
            <Avatar teen={teen} />
          </div>
          <div
            className={`flex-1 min-w-0 ${hasPhone ? "cursor-pointer" : ""}`}
            onClick={() => hasPhone && onOpenProfile(teen._id)}
          >
            <p className="text-sm font-semibold leading-tight">
              {esc(teen.nombre)} {esc(teen.apellido)}
            </p>
            <p className="text-xs opacity-75 mt-0.5 leading-tight">{r.action}</p>
          </div>
        </div>
        {/* Fila inferior: badge label + score + whatsapp */}
        <div className="flex items-center justify-between px-3 pb-2.5">
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-current opacity-80">
            {r.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{
                background: ({
                  gray: "#6B7280", teal: "#0B7285", amber: "#F0A33C",
                  coral: "#E8590C", red: "#DC2626",
                } as Record<string, string>)[r.color],
              }}
            >
              {r.score}
            </span>
            {hasPhone && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowWA(true); }}
                className="w-7 h-7 rounded-lg bg-white/70 hover:bg-white/90 dark:bg-card/40 dark:hover:bg-card/60 flex items-center justify-center transition border border-ink/5 shadow-sm pressable"
              >
                <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {showWA && (
        <WhatsAppModal
          nombre={teen.nombre}
          telefono={teen.telefono}
          telefonoPadre={teen.telefonoPadre}
          templates={alertTemplates}
          onClose={() => setShowWA(false)}
        />
      )}
    </>
  );
}

function FollowUpRow({
  teen,
  entry,
  onOpenProfile,
}: {
  teen: Doc<"teens">;
  entry: Doc<"journal">;
  onOpenProfile: (id: string) => void;
}) {
  const categoryIcons: Record<string, string> = {
    call: "📞", visit: "🏠", chat: "📱", counseling: "💬", prayer: "🙏", other: "📝",
  };
  const icon = categoryIcons[entry.category] || "📝";
  return (
    <div
      className="rounded-xl border border-coral-100 bg-coral-50/50 overflow-hidden cursor-pointer hover:bg-coral-50 transition"
      onClick={() => onOpenProfile(teen._id)}
    >
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
        <Avatar teen={teen} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {esc(teen.nombre)} {esc(teen.apellido)}
          </p>
          <p className="text-xs text-ink/50 truncate">
            {icon} {esc(entry.leaderName || "Anónimo")} · {fmtDate(entry.entryDate)}
          </p>
        </div>
      </div>
      <div className="px-3 pb-2.5">
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-coral-600 px-1.5 py-0.5 rounded border border-coral-300 bg-coral-100/60">
          📌 Pendiente seguimiento
        </span>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
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
      <p className="text-sm font-semibold text-ink/70">{title}</p>
      <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">{sub}</p>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c0-1-.3-1.7-.6-2.4.9.6 1.6 1.7 1.6 3.4 0 2.8-1.8 5-4 5s-5-2.5-5-6c0-3.5 2-6.6 5-8z" />
    </svg>
  );
}
