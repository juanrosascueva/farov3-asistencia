import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { esc, fmtDate } from "../lib/utils";

const priorities = [
  ["low", "Baja"],
  ["medium", "Media"],
  ["high", "Alta"],
  ["critical", "Crítica"],
] as const;
const statuses = [
  ["pending", "Pendiente"],
  ["in_progress", "En proceso"],
  ["done", "Realizado"],
  ["rescheduled", "Reprogramado"],
  ["canceled", "Cancelado"],
  ["escalated", "Escalado"],
] as const;

export default function PastoralTasksCard({ teenId }: { teenId: string }) {
  const { token } = useAuth();
  const tasks = useQuery(api.pastoralTasks.listByTeen, token ? { token, teenId: teenId as any } : "skip") ?? [];
  const users = useQuery(api.pastoralTasks.listAssignableUsers, token ? { token } : "skip") ?? [];
  const createTask = useMutation(api.pastoralTasks.create);
  const updateStatus = useMutation(api.pastoralTasks.updateStatus);
  const removeTask = useMutation(api.pastoralTasks.remove);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assignedToUserId: "", dueDate: "", priority: "medium" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !form.title.trim()) return;
    await createTask({
      token,
      teenId: teenId as any,
      source: "manual",
      title: form.title,
      description: form.description || undefined,
      assignedToUserId: form.assignedToUserId ? form.assignedToUserId as any : undefined,
      dueDate: form.dueDate || undefined,
      priority: form.priority as any,
    });
    setForm({ title: "", description: "", assignedToUserId: "", dueDate: "", priority: "medium" });
    setShowForm(false);
  };

  const inputClass = "w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm";

  return (
    <div className="bg-card rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-base">Tareas Pastorales</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-semibold bg-primary-600 text-white rounded-full px-3 py-1.5">
          {showForm ? "Cerrar" : "Nueva tarea"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 p-4 rounded-xl border border-ink/10 bg-ink/[0.02] space-y-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Llamar al apoderado, visitar a la familia..." className={inputClass} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Detalle opcional" className={`${inputClass} resize-none`} />
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })} className={inputClass}>
              <option value="">Sin asignar</option>
              {users.map((u: any) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
              {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-primary-600 text-white rounded-xl py-2.5 text-sm font-semibold">Crear tarea</button>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-sm text-ink/40 text-center py-6">No hay tareas pastorales registradas.</p>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task: any) => (
            <div key={task._id} className="p-3 rounded-xl border border-ink/10 bg-ink/[0.02]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink/80">{esc(task.title)}</p>
                  {task.description && <p className="text-xs text-ink/50 whitespace-pre-line mt-0.5">{esc(task.description)}</p>}
                  <p className="text-xs text-ink/40 mt-1">
                    {task.assignedName || "Sin responsable"} · {task.dueDate ? fmtDate(task.dueDate) : "Sin fecha"} · {priorities.find(([p]) => p === task.priority)?.[1] || task.priority}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={task.status} onChange={(e) => token && updateStatus({ token, taskId: task._id, status: e.target.value as any })} className="bg-card border border-ink/10 rounded-lg px-2 py-1 text-xs">
                    {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button onClick={() => token && removeTask({ token, taskId: task._id })} className="w-8 h-8 rounded-lg bg-danger-50 text-danger-600 hover:bg-danger-100">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
