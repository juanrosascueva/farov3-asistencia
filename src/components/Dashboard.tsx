import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";

interface DashboardProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
  onNavigate: (route: string) => void;
}

const priorityLabel: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja" };

export default function Dashboard({ teens, attendanceMap, onOpenProfile, onNavigate }: DashboardProps) {
  const { token } = useAuth();
  const { scope, scopeLabel } = useScope();
  const activeScopeArgs = { campusId: scope.campusId as any, ministryId: scope.ministryId as any, groupId: scope.groupId as any };
  const summary = useQuery(api.dashboard.getRoleSummary, token ? { token, ...activeScopeArgs } : "skip") as any;
  const queue = useQuery(api.followUp.getQueue, token ? { token, ...activeScopeArgs } : "skip") ?? [];
  const dates = Object.keys(attendanceMap).sort();
  const latestDate = dates[dates.length - 1];
  const latestRecords = latestDate ? Object.values(attendanceMap[latestDate] || {}) : [];
  const attendancePct = latestRecords.length ? Math.round((latestRecords.filter((status) => status === "present").length / latestRecords.length) * 100) : 0;
  const priorities = queue.slice(0, 3);
  const metrics = summary?.metrics;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-700">Mi ministerio</p>
        <h1 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Estado y prioridades</h1>
        <p className="mt-1 text-sm text-ink/50">{scopeLabel}</p>
      </header>

      <section className="rounded-card border border-ink/10 bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-teal-700">Prioridades de hoy</p>
            <p className="mt-1 text-sm text-ink/50">Acciones que requieren una respuesta pastoral.</p>
          </div>
          <button onClick={() => onNavigate("seguimiento")} className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white">Ver Seguimiento</button>
        </div>
        {priorities.length ? <div className="mt-4 grid gap-2 lg:grid-cols-3">{priorities.map((item: any) => (
          <button key={item.id} onClick={() => onOpenProfile(String(item.teenId))} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3 text-left">
            <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-amber-900">{item.teenName}</span><span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-amber-800">{priorityLabel[item.priority] || "Media"}</span></div>
            <p className="mt-1 line-clamp-2 text-xs text-amber-700">{item.title}: {item.detail}</p>
          </button>
        ))}</div> : <p className="mt-4 text-sm text-ink/45">No hay prioridades abiertas en este ámbito.</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Asistencia reciente" value={latestRecords.length ? `${attendancePct}%` : "-"} detail={latestDate || "Sin sesiones"} />
        <Metric label="Tareas abiertas" value={String(queue.filter((item: any) => item.kind === "task").length)} detail="Ver Seguimiento" />
        <Metric label="Fichas por completar" value={String(metrics?.incompleteProfiles ?? 0)} detail={`${teens.length} adolescentes`} />
      </section>

      <section className="flex flex-wrap gap-2">
        <button onClick={() => onNavigate("asistencia")} className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800">Tomar asistencia</button>
        <button onClick={() => onNavigate("jovenes")} className="rounded-lg border border-ink/10 bg-card px-4 py-3 text-sm font-bold text-ink/70">Ver adolescentes</button>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-card border border-ink/10 bg-card p-4 shadow-soft"><p className="text-xs font-semibold text-ink/45">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-ink/40">{detail}</p></div>;
}
