import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";

type Filter = "all" | "mine" | "overdue" | "high" | "signals";
const priorityLabel: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja" };

export default function Seguimiento({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { token, user } = useAuth();
  const { scope, scopeLabel } = useScope();
  const [filter, setFilter] = useState<Filter>("all");
  const activeScopeArgs = { campusId: scope.campusId as any, ministryId: scope.ministryId as any, groupId: scope.groupId as any };
  const queue = useQuery(api.followUp.getQueue, token ? { token, ...activeScopeArgs } : "skip") ?? [];
  const createTask = useMutation(api.pastoralTasks.create);
  const updateStatus = useMutation(api.pastoralTasks.updateStatus);
  const reassign = useMutation(api.pastoralTasks.reassign);
  const assignableUsers = useQuery(api.pastoralTasks.listAssignableUsers, token ? { token } : "skip") ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const items = useMemo(() => queue.filter((item: any) => {
    if (filter === "mine") return String(item.assignedToUserId || "") === String(user?._id || "");
    if (filter === "overdue") return item.kind === "task" && item.dueDate && item.dueDate < today;
    if (filter === "high") return ["critical", "high"].includes(item.priority);
    if (filter === "signals") return item.kind === "signal";
    return true;
  }), [filter, queue, today, user?._id]);

  const createFromSignal = async (item: any) => {
    if (!token) return;
    await createTask({ token, teenId: item.teenId, source: item.kind === "crisis" ? "crisis" : "manual", title: item.suggestedTaskTitle || item.title, description: item.detail, priority: item.priority, relatedCrisisAlertId: item.crisisAlertId });
  };

  const actionToday = items.filter((item: any) => item.kind === "crisis" || (item.kind === "task" && !["in_progress", "rescheduled"].includes(item.status)));
  const awaitingResponse = items.filter((item: any) => item.kind === "task" && ["in_progress", "rescheduled"].includes(item.status));
  const signalsWithoutTask = items.filter((item: any) => item.kind === "signal");

  const renderItem = (item: any) => (
    <article key={item.id} className="rounded-card border border-ink/10 bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button onClick={() => onOpenProfile(String(item.teenId))} className="min-w-0 text-left">
          <p className="text-sm font-bold text-ink">{item.teenName}</p>
          <p className="mt-1 text-sm font-semibold text-ink/75">{item.title}</p>
          <p className="mt-1 text-xs text-ink/50">{item.detail}</p>
          <p className="mt-2 text-xs text-ink/40">{item.assignedName || "Sin responsable"}{item.dueDate ? ` · Vence ${item.dueDate}` : ""}</p>
        </button>
        <div className="flex shrink-0 flex-wrap gap-2">
          <span className={`rounded-full px-2 py-1 text-micro font-bold ${item.priority === "critical" ? "bg-danger-50 text-danger-700" : item.priority === "high" ? "bg-warning-50 text-warning-700" : "bg-primary-50 text-primary-700"}`}>{priorityLabel[item.priority] || "Media"}</span>
          {item.kind === "task" ? <>
            <button onClick={() => updateStatus({ token: token!, taskId: item.taskId, status: "in_progress" })} className="ui-button ui-button--secondary px-2 py-1 text-xs">En proceso</button>
            <button onClick={() => updateStatus({ token: token!, taskId: item.taskId, status: "done" })} className="ui-button ui-button--primary px-2 py-1 text-xs">Realizada</button>
            <select value={item.assignedToUserId || ""} onChange={(event) => event.target.value && reassign({ token: token!, taskId: item.taskId, assignedToUserId: event.target.value as any })} className="rounded-lg border border-ink/10 bg-card px-2 py-1 text-xs font-semibold text-ink">
              <option value="">Asignar...</option>
              {assignableUsers.map((person: any) => <option key={person._id} value={person._id}>{person.name}</option>)}
            </select>
          </> : <button onClick={() => createFromSignal(item)} className="ui-button ui-button--primary px-3 py-2 text-xs">Crear tarea</button>}
        </div>
      </div>
    </article>
  );

  const renderSection = (title: string, description: string, sectionItems: any[], empty: string) => (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3"><div><h2 className="text-base font-bold text-ink">{title}</h2><p className="mt-0.5 text-xs text-ink/50">{description}</p></div><span className="game-pill bg-primary-50 text-primary-700">{sectionItems.length}</span></div>
      {sectionItems.length ? <div className="space-y-2">{sectionItems.map(renderItem)}</div> : <div className="rounded-card border border-dashed border-ink/15 bg-card px-4 py-3 text-sm text-ink/45">{empty}</div>}
    </section>
  );

  const isFiltered = filter !== "all";
  return <div className="space-y-6">
    <header><p className="text-xs font-semibold uppercase text-primary-700">Acompañamiento pastoral</p><h1 className="mt-0.5 font-display text-2xl font-bold">Seguimiento</h1><p className="mt-1 text-sm text-ink/50">{scopeLabel}</p></header>
    <div className="flex gap-2 overflow-x-auto pb-1">{([ ["all", "Todo"], ["mine", "Para mí"], ["overdue", "Vencidas"], ["high", "Alta prioridad"], ["signals", "Sin tarea"] ] as [Filter, string][]).map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={`ui-segment shrink-0 ${filter === id ? "ui-segment--active" : ""}`}>{label}</button>)}</div>
    {isFiltered
      ? renderSection("Resultados", "Elementos según el filtro seleccionado.", items, "No hay seguimientos en esta vista.")
      : <div className="space-y-7">
          {renderSection("Para actuar hoy", "Tareas pendientes, vencidas o alertas que requieren una decisión.", actionToday, "No hay acciones urgentes en este momento.")}
          {renderSection("Esperando respuesta", "Contactos o tareas en proceso que necesitan una nueva revisión.", awaitingResponse, "No hay contactos esperando respuesta.")}
          {renderSection("Sin tarea asignada", "Señales de asistencia pendientes de evaluar antes de crear una tarea.", signalsWithoutTask, "No hay señales de asistencia sin tarea.")}
        </div>}
  </div>;
}
