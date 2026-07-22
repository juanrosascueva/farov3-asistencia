import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  const [supervisorFilter, setSupervisorFilter] = useState<"scope" | "mine">("scope");
  const scopeArgs = { campusId: scope.campusId as any, ministryId: scope.ministryId as any, groupId: scope.groupId as any };
  const summary = useQuery(api.dashboard.getRoleSummary, token ? { token, ...scopeArgs } : "skip") as any;
  const assignableUsers = useQuery(api.pastoralTasks.listAssignableUsers, token ? { token } : "skip") ?? [];
  const updateStatus = useMutation(api.pastoralTasks.updateStatus);
  const createTask = useMutation(api.pastoralTasks.create);
  const assignLeader = useMutation(api.teens.bulkAssignLeader);
  const portfolio = summary?.portfolio;
  const dates = Object.keys(attendanceMap).sort();
  const latestDate = dates[dates.length - 1];
  const latestRecords = latestDate ? Object.values(attendanceMap[latestDate] || {}) : [];
  const attendancePct = latestRecords.length ? Math.round((latestRecords.filter((status) => status === "present").length / latestRecords.length) * 100) : 0;
  const isSupervisor = portfolio?.isSupervisor === true;
  const supervisorItems = supervisorFilter === "mine" ? portfolio?.myTasks ?? [] : portfolio?.supervisionPriorities ?? [];

  const createFromSignal = async (signal: any) => {
    if (!token) return;
    await createTask({
      token,
      teenId: signal.teenId,
      source: "manual",
      title: `Dar seguimiento: ${signal.reasons[0]}`,
      description: signal.reasons.join(" · "),
      priority: signal.priority,
    });
  };

  const assignFromDashboard = async (teenId: string, leaderId: string) => {
    if (!token || !leaderId) return;
    await assignLeader({ token, teenIds: [teenId as any], liderPrincipalId: leaderId as any, useGroupLeader: false });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase text-teal-700">Mi ministerio</p>
        <h1 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">Estado y prioridades</h1>
        <p className="mt-1 text-sm text-ink/50">{scopeLabel}</p>
      </header>

      {isSupervisor ? (
        <section className="rounded-card border border-ink/10 bg-card p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase text-teal-700">Supervisión del ámbito</p><p className="mt-1 text-sm text-ink/50">Prioriza lo vencido, escalado o sin responsable.</p></div>
            <div className="flex gap-1 rounded-lg bg-ink/[0.04] p-1"><button onClick={() => setSupervisorFilter("scope")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${supervisorFilter === "scope" ? "bg-card shadow-sm text-ink" : "text-ink/45"}`}>Del ámbito</button><button onClick={() => setSupervisorFilter("mine")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${supervisorFilter === "mine" ? "bg-card shadow-sm text-ink" : "text-ink/45"}`}>Para mí</button></div>
          </div>
          <PriorityList items={supervisorItems} onOpenProfile={onOpenProfile} onStart={(task: any) => token && updateStatus({ token, taskId: task.taskId, status: "in_progress" })} />
        </section>
      ) : (
        <>
          <section className="rounded-card border border-ink/10 bg-card p-4 shadow-soft sm:p-5">
            <SectionHeading title="Mis tareas de hoy" helper="Tareas asignadas directamente a ti." action="Ver Seguimiento" onAction={() => onNavigate("seguimiento")} />
            <PriorityList items={portfolio?.myTasks ?? []} onOpenProfile={onOpenProfile} onStart={(task: any) => token && updateStatus({ token, taskId: task.taskId, status: "in_progress" })} empty="No tienes tareas pastorales abiertas." />
          </section>
          <section className="rounded-card border border-ink/10 bg-card p-4 shadow-soft sm:p-5">
            <SectionHeading title="Mis adolescentes requieren contacto" helper="Señales de asistencia sin una tarea abierta." />
            <SignalList items={portfolio?.mySignals ?? []} onOpenProfile={onOpenProfile} onCreate={createFromSignal} />
          </section>
        </>
      )}

      {isSupervisor && <section className="rounded-card border border-amber-200 bg-amber-50/70 p-4 sm:p-5"><SectionHeading title="Sin responsable" helper="Adolescentes que no tienen líder individual ni líder de grupo." /><div className="mt-3 grid gap-2 lg:grid-cols-2">{portfolio?.unassigned?.length ? portfolio.unassigned.map((item: any) => <div key={item.teenId} className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-card px-3 py-2.5"><button onClick={() => onOpenProfile(String(item.teenId))} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-bold text-amber-950">{item.teenName}</p><p className="mt-0.5 truncate text-xs text-amber-800">{item.reason}</p></button><select aria-label={`Asignar líder a ${item.teenName}`} defaultValue="" onChange={(event) => assignFromDashboard(String(item.teenId), event.target.value)} className="rounded-lg border border-amber-200 bg-card px-2 py-1.5 text-xs font-semibold text-ink"><option value="" disabled>Asignar...</option>{assignableUsers.map((user: any) => <option key={user._id} value={user._id}>{user.name}</option>)}</select></div>) : <p className="text-sm text-amber-800">Todos los adolescentes de este ámbito tienen un responsable.</p>}</div></section>}
      {isSupervisor && summary?.metrics?.teamCoverage?.length > 0 && <section className="rounded-card border border-ink/10 bg-card p-4 sm:p-5"><SectionHeading title="Cobertura del equipo" helper="Cartera actual, tareas abiertas y carga declarada por líder." /><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{summary.metrics.teamCoverage.map((item: any) => <div key={item.userId} className="rounded-lg border border-ink/10 p-3"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-ink/55">{item.assigned}/{item.capacity} adolescentes · {item.openTasks} tareas</p>{item.overdue > 0 && <p className="mt-1 text-xs font-semibold text-coral-700">{item.overdue} vencida(s)</p>}</div>)}</div></section>}
      {!isSupervisor && portfolio?.myTasks?.some((task: any) => task.dueDate) && <section className="rounded-card border border-teal-100 bg-teal-50/60 p-4 sm:p-5"><SectionHeading title="Recordatorios internos" helper="Tareas con fecha pendiente. El contacto se registra cuando realmente se realiza." action="Ver Seguimiento" onAction={() => onNavigate("seguimiento")} /><div className="mt-3 flex flex-wrap gap-2">{portfolio.myTasks.filter((task: any) => task.dueDate).slice(0, 3).map((task: any) => <button key={task.taskId} onClick={() => onOpenProfile(String(task.teenId))} className="rounded-lg border border-teal-200 bg-card px-3 py-2 text-left text-xs"><strong>{task.teenName}</strong><span className="block text-teal-700">Vence {task.dueDate}</span></button>)}</div></section>}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label={isSupervisor ? "Cobertura pastoral" : "Mis adolescentes"} value={isSupervisor ? `${portfolio?.assignedTeens ?? 0}/${portfolio?.totalTeens ?? 0}` : String(portfolio?.assignedTeens ?? 0)} detail={isSupervisor ? "Con líder responsable" : "Asignados a tu cartera"} />
        <Metric label={isSupervisor ? "Tareas vencidas" : "Contactos pendientes"} value={String(isSupervisor ? summary?.metrics?.overdueTasks ?? 0 : portfolio?.mySignals?.length ?? 0)} detail={isSupervisor ? "Requieren supervisión" : "Señales sin tarea"} />
        <Metric label="Asistencia reciente" value={latestRecords.length ? `${attendancePct}%` : "-"} detail={latestDate || "Sin sesiones"} />
      </section>

      <section className="flex flex-wrap gap-2"><button onClick={() => onNavigate("asistencia")} className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-800">Tomar asistencia</button><button onClick={() => onNavigate("seguimiento")} className="rounded-lg border border-ink/10 bg-card px-4 py-3 text-sm font-bold text-ink/70">Ver Seguimiento</button><button onClick={() => onNavigate("jovenes")} className="rounded-lg border border-ink/10 bg-card px-4 py-3 text-sm font-bold text-ink/70">Ver adolescentes</button></section>
    </div>
  );
}

function SectionHeading({ title, helper, action, onAction }: { title: string; helper: string; action?: string; onAction?: () => void }) { return <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-teal-700">{title}</p><p className="mt-1 text-sm text-ink/50">{helper}</p></div>{action && <button onClick={onAction} className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white">{action}</button>}</div>; }
function PriorityList({ items, onOpenProfile, onStart, empty = "No hay prioridades abiertas." }: any) { return items.length ? <div className="mt-4 grid gap-2 lg:grid-cols-3">{items.map((item: any) => <div key={item.taskId} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-3"><button onClick={() => onOpenProfile(String(item.teenId))} className="w-full text-left"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-amber-900">{item.teenName}</span><span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold text-amber-800">{priorityLabel[item.priority] || "Media"}</span></div><p className="mt-1 line-clamp-2 text-xs text-amber-700">{item.title}: {item.detail}</p><p className="mt-2 text-[11px] text-amber-800">{item.assignedName}{item.dueDate ? ` · Vence ${item.dueDate}` : ""}</p></button><button onClick={() => onStart(item)} className="mt-3 rounded-md border border-amber-200 bg-card px-2 py-1 text-xs font-bold text-amber-900">En proceso</button></div>)}</div> : <p className="mt-4 text-sm text-ink/45">{empty}</p>; }
function SignalList({ items, onOpenProfile, onCreate }: any) { return items.length ? <div className="mt-4 grid gap-2 lg:grid-cols-3">{items.map((item: any) => <div key={item.teenId} className="rounded-lg border border-teal-100 bg-teal-50 px-3 py-3"><button onClick={() => onOpenProfile(String(item.teenId))} className="w-full text-left"><p className="truncate text-sm font-semibold text-teal-900">{item.teenName}</p><p className="mt-1 line-clamp-2 text-xs text-teal-700">{item.reasons.join(" · ")}</p></button><button onClick={() => onCreate(item)} className="mt-3 rounded-md bg-teal-700 px-2 py-1 text-xs font-bold text-white">Crear tarea</button></div>)}</div> : <p className="mt-4 text-sm text-ink/45">No hay señales nuevas que requieran contacto.</p>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-card border border-ink/10 bg-card p-4 shadow-soft"><p className="text-xs font-semibold text-ink/45">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-ink/40">{detail}</p></div>; }
