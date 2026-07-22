import { FormEvent, useEffect, useState } from "react";
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

export default function PastoralPlanCard({ teenId }: { teenId: string }) {
  const { token } = useAuth();
  const plan = useQuery(api.pastoralPlans.getByTeen, token ? { token, teenId: teenId as any } : "skip");
  const users = useQuery(api.pastoralTasks.listAssignableUsers, token ? { token } : "skip") ?? [];
  const savePlan = useMutation(api.pastoralPlans.upsertActive);
  const completePlan = useMutation(api.pastoralPlans.complete);
  const createTask = useMutation(api.pastoralTasks.create);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    currentState: "",
    mainNeed: "",
    monthlyGoal: "",
    recommendedAction: "",
    assignedToUserId: "",
    dueDate: "",
    followUpResult: "",
    priority: "medium",
  });

  useEffect(() => {
    if (!plan) return;
    setForm({
      currentState: plan.currentState || "",
      mainNeed: plan.mainNeed || "",
      monthlyGoal: plan.monthlyGoal || "",
      recommendedAction: plan.recommendedAction || "",
      assignedToUserId: plan.assignedToUserId || "",
      dueDate: plan.dueDate || "",
      followUpResult: plan.followUpResult || "",
      priority: plan.priority || "medium",
    });
  }, [plan]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !form.currentState.trim() || !form.mainNeed.trim()) return;
    await savePlan({
      token,
      teenId: teenId as any,
      currentState: form.currentState,
      mainNeed: form.mainNeed,
      monthlyGoal: form.monthlyGoal,
      recommendedAction: form.recommendedAction,
      assignedToUserId: form.assignedToUserId ? form.assignedToUserId as any : undefined,
      dueDate: form.dueDate || undefined,
      followUpResult: form.followUpResult || undefined,
      priority: form.priority as any,
    });
    setEditing(false);
  };

  const makeTask = async () => {
    if (!token || !plan) return;
    await createTask({
      token,
      teenId: teenId as any,
      source: "plan",
      title: plan.recommendedAction || plan.mainNeed,
      description: [plan.currentState, plan.monthlyGoal].filter(Boolean).join("\n"),
      assignedToUserId: plan.assignedToUserId,
      dueDate: plan.dueDate,
      priority: plan.priority,
      relatedPlanId: plan._id,
    });
  };

  const inputClass = "w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-sm";
  const field = (key: keyof typeof form, label: string, textarea = false) => (
    <label className="block">
      <span className="text-xs font-semibold text-ink/50 mb-1 block">{label}</span>
      {textarea ? (
        <textarea value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={2} className={`${inputClass} resize-none`} />
      ) : (
        <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} />
      )}
    </label>
  );

  return (
    <div className="bg-card rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-base">Plan Pastoral</h2>
        <button onClick={() => setEditing(!editing)} className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 rounded-full px-3 py-1.5">
          {editing || !plan ? "Cerrar" : "Editar"}
        </button>
      </div>

      {(editing || !plan) ? (
        <form onSubmit={submit} className="space-y-3">
          {field("currentState", "Estado pastoral actual", true)}
          {field("mainNeed", "Necesidad principal detectada", true)}
          {field("monthlyGoal", "Objetivo pastoral del mes", true)}
          {field("recommendedAction", "Próxima acción recomendada", true)}
          <div className="grid sm:grid-cols-3 gap-3">
            <label>
              <span className="text-xs font-semibold text-ink/50 mb-1 block">Responsable</span>
              <select value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })} className={inputClass}>
                <option value="">Sin asignar</option>
                {users.map((u: any) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-ink/50 mb-1 block">Fecha límite</span>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="text-xs font-semibold text-ink/50 mb-1 block">Prioridad</span>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inputClass}>
                {priorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          {field("followUpResult", "Resultado del seguimiento", true)}
          <button type="submit" className="w-full bg-primary-600 text-white rounded-xl py-2.5 text-sm font-semibold">Guardar plan</button>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          <Info label="Estado actual" value={plan.currentState} />
          <Info label="Necesidad" value={plan.mainNeed} />
          <Info label="Objetivo mensual" value={plan.monthlyGoal} />
          <Info label="Próxima acción" value={plan.recommendedAction} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Info label="Responsable" value={plan.assignedName || "Sin asignar"} />
            <Info label="Fecha límite" value={plan.dueDate ? fmtDate(plan.dueDate) : "Sin fecha"} />
            <Info label="Prioridad" value={priorities.find(([p]) => p === plan.priority)?.[1] || plan.priority} />
          </div>
          {plan.followUpResult && <Info label="Resultado" value={plan.followUpResult} />}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button onClick={makeTask} className="flex-1 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-semibold">Crear tarea desde plan</button>
            <button onClick={() => token && completePlan({ token, planId: plan._id, followUpResult: plan.followUpResult })} className="flex-1 bg-ink/5 text-ink/60 rounded-xl py-2.5 text-sm font-semibold">Completar plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-ink/80 whitespace-pre-line">{value ? esc(value) : "-"}</p>
    </div>
  );
}
