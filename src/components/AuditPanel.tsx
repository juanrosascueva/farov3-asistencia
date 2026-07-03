import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";
import { fmtDate, esc } from "../lib/utils";

const actionLabels: Record<string, string> = {
  "teen.created": "Ficha creada",
  "teen.updated": "Ficha editada",
  "teen.deactivated": "Estado de adolescente cambiado",
  "teen.deleted": "Ficha eliminada",
  "teen.archived": "Ficha archivada",
  "journal.viewed": "Bitácora vista",
  "journal.created": "Bitácora creada",
  "journal.deleted": "Bitácora eliminada",
  "ai.analysis.generated": "Análisis IA",
  "ai.summary.generated": "Resumen IA",
  "ai.dropout.generated": "Predicción IA",
  "ai.chat.generated": "Chat IA",
  "user.created": "Usuario creado",
  "user.updated": "Usuario editado",
  "user.role_changed": "Rol cambiado",
  "user.permission_changed": "Permisos cambiados",
  "user.deleted": "Usuario eliminado",
  "user.scope_assigned": "Ámbito asignado",
  "user.scope_removed": "Ámbito removido",
  "role.created": "Rol creado",
  "role.permission_changed": "Permisos de rol cambiados",
  "role.deleted": "Rol eliminado",
  "pastoral_plan.created": "Plan creado",
  "pastoral_plan.updated": "Plan editado",
  "pastoral_plan.completed": "Plan completado",
  "pastoral_task.created": "Tarea creada",
  "pastoral_task.updated": "Tarea editada",
  "pastoral_task.deleted": "Tarea eliminada",
  "crisis.status_changed": "Crisis actualizada",
  "crisis.referred": "Crisis derivada",
  "crisis.attended": "Crisis atendida",
  "transition.created": "Transición creada",
  "transition.completed": "Transición completada",
  "transition.canceled": "Transición cancelada",
  "data.exported": "Datos exportados",
  "data.bulk_deleted": "Borrado masivo",
  "data.bulk_archived": "Archivado masivo",
};

const sensitivityLabels: Record<string, string> = {
  basic: "Básica",
  contact: "Contacto",
  pastoral: "Pastoral",
  sensitive: "Sensible",
};

function shortDevice(value: string | undefined): string {
  if (!value) return "-";
  const parts = value.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return `${parts[0]} · ${parts[1]} · ${parts[2]}`;
  if (/Chrome/i.test(value)) return "Chrome";
  if (/Firefox/i.test(value)) return "Firefox";
  if (/Safari/i.test(value)) return "Safari";
  return value.slice(0, 60);
}

export default function AuditPanel() {
  const { token } = useAuth();
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const logs = useQuery(api.auditLog.list, token ? {
    token,
    limit: 150,
    action: action || undefined,
    entityType: entityType || undefined,
  } : "skip") ?? [];

  const actions = useMemo(() => Object.entries(actionLabels).sort((a, b) => a[1].localeCompare(b[1])), []);
  const entityTypes = ["teen", "journal", "user", "userScope", "customRole", "pastoralPlan", "pastoralTask", "crisisAlert", "ministryTransition", "export", "system"];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Seguridad
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">Auditoría</h1>
      </div>

      <div className="bg-card rounded-card shadow-soft p-4 sm:p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm">
            <option value="">Todas las acciones</option>
            {actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm">
            <option value="">Todas las entidades</option>
            {entityTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <div className="text-xs text-ink/40 flex items-center sm:justify-end">
            {logs.length} registro{logs.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1040px]">
            <thead>
              <tr className="text-left text-xs text-ink/40 border-b border-ink/10">
                <th className="py-2 pr-3 font-semibold">Fecha</th>
                <th className="py-2 pr-3 font-semibold">Usuario</th>
                <th className="py-2 pr-3 font-semibold">Acción</th>
                <th className="py-2 pr-3 font-semibold">Entidad</th>
                <th className="py-2 pr-3 font-semibold">Sensibilidad</th>
                <th className="py-2 pr-3 font-semibold">Campos</th>
                <th className="py-2 pr-3 font-semibold">Dispositivo</th>
                <th className="py-2 pr-3 font-semibold">IP</th>
                <th className="py-2 pr-3 font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log: any) => (
                <tr key={log._id} className="border-b border-ink/5 align-top">
                  <td className="py-2 pr-3 text-xs text-ink/50 whitespace-nowrap">{fmtDate(log.createdAt.slice(0, 10))}</td>
                  <td className="py-2 pr-3">{esc(log.userName || "Sistema")}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex rounded-full bg-ink/5 px-2 py-1 text-xs font-semibold text-ink/60">
                      {actionLabels[log.action] || log.action}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink/50">
                    {esc(log.entityType || log.targetType || "-")}
                    {log.entityId || log.targetId ? <span className="block font-mono text-[10px]">{esc(log.entityId || log.targetId)}</span> : null}
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink/50 whitespace-nowrap">
                    {esc(sensitivityLabels[log.sensitivityLevel] || log.sensitivityLevel || "-")}
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink/50 max-w-[160px]">
                    {Array.isArray(log.changedFields) && log.changedFields.length > 0 ? esc(log.changedFields.join(", ")) : "-"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink/50 max-w-[180px]" title={log.userAgent || ""}>
                    {esc(shortDevice(log.userAgent))}
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink/50 whitespace-nowrap">
                    {esc(log.ip || "-")}
                  </td>
                  <td className="py-2 pr-3 text-xs text-ink/60 max-w-sm">
                    {esc(log.details || "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <p className="text-center text-sm text-ink/40 py-8">No hay registros de auditoría para estos filtros.</p>
          )}
        </div>
      </div>
    </div>
  );
}
