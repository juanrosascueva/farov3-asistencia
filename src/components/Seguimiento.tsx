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
    if (filter === "signals") return item.kind !== "task";
    return true;
  }), [filter, queue, today, user?.name]);
  const createFromSignal = async (item: any) => {
    if (!token) return;
    await createTask({ token, teenId: item.teenId, source: item.kind === "crisis" ? "crisis" : "manual", title: item.suggestedTaskTitle || item.title, description: item.detail, priority: item.priority, relatedCrisisAlertId: item.crisisAlertId });
  };

  return <div className="space-y-5">
    <header><p className="text-xs font-semibold uppercase text-primary-700">Acompañamiento pastoral</p><h1 className="mt-0.5 font-display text-2xl font-bold">Seguimiento</h1><p className="mt-1 text-sm text-ink/50">{scopeLabel}</p></header>
    <div className="flex gap-2 overflow-x-auto pb-1">{([ ["all", "Todo"], ["mine", "Para mí"], ["overdue", "Vencidas"], ["high", "Alta prioridad"], ["signals", "Señales"] ] as [Filter, string][]).map(([id, label]) => <button key={id} onClick={() => setFilter(id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${filter === id ? "bg-primary-600 text-white" : "border border-ink/10 bg-card text-ink/55"}`}>{label}</button>)}</div>
    <div className="space-y-2">{items.length ? items.map((item: any) => <div key={item.id} className="rounded-card border border-ink/10 bg-card p-4 shadow-soft"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><button onClick={() => onOpenProfile(String(item.teenId))} className="min-w-0 text-left"><p className="text-sm font-bold">{item.teenName}</p><p className="mt-1 text-sm font-semibold text-ink/75">{item.title}</p><p className="mt-1 text-xs text-ink/50">{item.detail}</p><p className="mt-2 text-xs text-ink/40">{item.assignedName || "Sin responsable"}{item.dueDate ? ` · Vence ${item.dueDate}` : ""}</p></button><div className="flex shrink-0 flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.priority === "critical" ? "bg-danger-50 text-danger-700" : "bg-primary-50 text-primary-700"}`}>{priorityLabel[item.priority] || "Media"}</span>{item.kind === "task" ? <><button onClick={() => updateStatus({ token: token!, taskId: item.taskId, status: "in_progress" })} className="rounded-lg border border-ink/10 px-2 py-1 text-xs font-semibold">En proceso</button><button onClick={() => updateStatus({ token: token!, taskId: item.taskId, status: "done" })} className="rounded-lg bg-primary-600 px-2 py-1 text-xs font-semibold text-white">Realizada</button><select value={item.assignedToUserId || ""} onChange={(event) => event.target.value && reassign({ token: token!, taskId: item.taskId, assignedToUserId: event.target.value as any })} className="rounded-lg border border-ink/10 bg-card px-2 py-1 text-xs font-semibold"><option value="">Asignar...</option>{assignableUsers.map((person: any) => <option key={person._id} value={person._id}>{person.name}</option>)}</select></> : <button onClick={() => createFromSignal(item)} className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-bold text-white">Crear tarea</button>}</div></div></div>) : <div className="rounded-card border border-ink/10 bg-card p-8 text-center text-sm text-ink/45">No hay seguimientos en esta vista.</div>}</div>
  </div>;
}
