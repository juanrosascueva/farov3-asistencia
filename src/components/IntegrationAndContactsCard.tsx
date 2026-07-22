import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../hooks/useAuth";

const MILESTONES = [
  ["registered", "Registro"], ["guardian_confirmed", "Apoderado confirmado"], ["first_attendance", "Primera asistencia"], ["group_assigned", "Grupo asignado"],
  ["first_contact", "Primer contacto"], ["three_attendances", "Tres asistencias"], ["pastoral_conversation", "Conversación pastoral"], ["discipleship_or_service", "Discipulado o servicio"],
] as const;

export function IntegrationCard({ teenId }: { teenId: any }) {
  const { token } = useAuth();
  const milestones = useQuery(api.integration.listByTeen, token ? { token, teenId } : "skip") ?? [];
  const complete = useMutation(api.integration.complete);
  const done = new Set(milestones.map((item: any) => item.type));
  const next = MILESTONES.find(([type]) => !done.has(type));
  return <section className="bg-card rounded-card shadow-soft p-5 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-display font-semibold text-base">Ruta de integración</h2><p className="text-xs text-ink/50 mt-1">Registra avances reales sin perder el historial.</p></div><span className="text-xs font-semibold text-primary-700">{done.size}/{MILESTONES.length}</span></div>
    <div className="flex flex-wrap gap-2">{MILESTONES.map(([type, label]) => <button key={type} disabled={!token || done.has(type)} onClick={() => token && complete({ token, teenId, type })} className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${done.has(type) ? "bg-primary-50 text-primary-700 border-primary-100" : "bg-ink/[0.02] text-ink/60 border-ink/10 hover:border-primary-300"}`}>{done.has(type) ? "✓ " : ""}{label}</button>)}</div>
    {next && <p className="text-xs text-ink/55">Siguiente hito sugerido: <strong className="text-ink">{next[1]}</strong></p>}
  </section>;
}

export function ContactLogsCard({ teenId }: { teenId: any }) {
  const { token } = useAuth(); const [open, setOpen] = useState(false); const [notes, setNotes] = useState(""); const [outcome, setOutcome] = useState<any>("contacted");
  const logs = useQuery(api.contactLogs.listByTeen, token ? { token, teenId } : "skip") ?? [];
  const context = useQuery(api.contactLogs.getContactContext, token ? { token, teenId } : "skip"); const create = useMutation(api.contactLogs.create);
  const canWhatsApp = Boolean(context?.teen?.permitsMessages || context?.guardians?.some((g: any) => g.permitsMessages));
  const save = async () => { if (!token) return; await create({ token, teenId, channel: "call", outcome, contactDate: new Date().toISOString(), notes }); setNotes(""); setOpen(false); };
  return <section className="bg-card rounded-card shadow-soft p-5 space-y-3"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display font-semibold text-base">Contactos familiares</h2><p className="text-xs text-ink/50 mt-1">Trazabilidad de contactos reales. No reemplaza la bitácora.</p></div><button onClick={() => setOpen(!open)} className="rounded-lg bg-primary-600 text-white px-3 py-2 text-xs font-semibold">{open ? "Cerrar" : "Registrar"}</button></div>
    {canWhatsApp ? <a href={`https://wa.me/${(context?.guardians?.find((g: any) => g.permitsMessages)?.phone || context?.teen?.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent("Hola, esperamos que se encuentre bien. Queremos acompañarles y saber cómo está.")}`} target="_blank" rel="noreferrer" className="inline-flex text-xs font-semibold text-primary-700 hover:underline">Preparar WhatsApp</a> : <p className="text-xs text-warning-700">Sin consentimiento de mensajes: solo se puede registrar seguimiento interno.</p>}
    {open && <div className="rounded-xl border border-ink/10 p-3 space-y-2"><select value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm"><option value="contacted">Contactado</option><option value="no_response">Sin respuesta</option><option value="rescheduled">Reprogramado</option><option value="not_applicable">No aplica</option></select><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Resumen breve del contacto" className="w-full rounded-lg border border-ink/10 p-3 text-sm" rows={3}/><button onClick={save} className="rounded-lg bg-primary-700 px-3 py-2 text-xs font-semibold text-white">Guardar contacto</button></div>}
    <div className="space-y-2">{logs.slice(0, 4).map((log: any) => <div key={log._id} className="border-l-2 border-primary-200 pl-3 text-xs"><p className="font-semibold capitalize">{log.channel} · {log.outcome.replace("_", " ")}</p><p className="text-ink/55">{log.notes || "Sin notas"}</p></div>)}{!logs.length && <p className="text-sm text-ink/45">Aún no se registraron contactos reales.</p>}</div>
  </section>;
}
