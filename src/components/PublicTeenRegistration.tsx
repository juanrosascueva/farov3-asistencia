import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const SOURCE_OPTIONS = [
  { value: "amigo", label: "Invitado por amigo" }, { value: "familiar", label: "Familiar" }, { value: "culto", label: "Culto" },
  { value: "campaña", label: "Campaña" }, { value: "escuela_biblica", label: "Escuela bíblica" }, { value: "otro", label: "Otro" },
];
const COMPLETED_BY_OPTIONS = [
  { value: "teen", label: "Adolescente" }, { value: "guardian", label: "Padre, madre o apoderado" }, { value: "leader", label: "Líder del ministerio" },
] as const;

function normalizePhone(value: string) { return value.replace(/[^\d+()\-\s]/g, "").replace(/\s+/g, " "); }

export default function PublicTeenRegistration({ publicToken, shortCode }: { publicToken: string; shortCode: string }) {
  const linkArgs = { publicToken: publicToken || undefined, shortCode: shortCode || undefined };
  const link = useQuery(api.teens.getPublicRegistrationLink, publicToken || shortCode ? linkArgs : "skip");
  const campuses = useQuery(api.teens.listPublicRegistrationCampuses, link?.scopeMode === "general" ? linkArgs : "skip");
  const [form, setForm] = useState({ nombre: "", apellido: "", nacimiento: "", edadAproximada: "", telefono: "", telefonoPadre: "", nombreEncargado: "", parentescoEncargado: "", invitadoPor: "", fuenteIngreso: "amigo", observacionInicial: "", consentimientoDatos: false, consentimientoFoto: false, completedBy: "teen" as "teen" | "guardian" | "leader", campusId: "", ministryId: "", groupId: "" });
  const ministries = useQuery(api.teens.listPublicRegistrationMinistries, link?.scopeMode === "general" && form.campusId ? { ...linkArgs, campusId: form.campusId as any } : "skip");
  const groups = useQuery(api.teens.listPublicRegistrationGroups, link?.scopeMode === "general" && form.ministryId ? { ...linkArgs, ministryId: form.ministryId as any } : "skip");
  const submit = useMutation(api.teens.submitPublicRegistration);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  const isGeneral = link?.scopeMode === "general";
  const scopeLabel = useMemo(() => link ? [link.campusName, link.ministryName, link.groupName].filter(Boolean).join(" / ") : "", [link]);
  const set = (key: keyof typeof form) => (value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const changeCampus = (value: string) => setForm(prev => ({ ...prev, campusId: value, ministryId: "", groupId: "" }));
  const changeMinistry = (value: string) => setForm(prev => ({ ...prev, ministryId: value, groupId: "" }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return; setError("");
    if (!form.nombre.trim() || !form.apellido.trim() || !form.telefonoPadre.trim()) return setError("Completa nombre, apellidos y contacto del apoderado.");
    if (isGeneral && (!form.campusId || !form.ministryId)) return setError("Selecciona la sede y el ministerio al que se integrará el adolescente.");
    setSaving(true);
    try {
      await submit({ ...linkArgs, campusId: isGeneral ? form.campusId as any : undefined, ministryId: isGeneral ? form.ministryId as any : undefined, groupId: isGeneral ? form.groupId as any : undefined, completedBy: form.completedBy, nombre: form.nombre.trim(), apellido: form.apellido.trim(), nacimiento: form.nacimiento || undefined, edadAproximada: form.edadAproximada.trim() || undefined, telefono: form.telefono.trim() || undefined, telefonoPadre: form.telefonoPadre.trim(), nombreEncargado: form.nombreEncargado.trim() || undefined, parentescoEncargado: form.parentescoEncargado.trim() || undefined, invitadoPor: form.invitadoPor.trim() || undefined, fuenteIngreso: form.fuenteIngreso as any, observacionInicial: form.observacionInicial.trim() || undefined, consentimientoDatos: form.completedBy === "guardian" ? form.consentimientoDatos : false, consentimientoFoto: form.completedBy === "guardian" ? form.consentimientoFoto : false });
      setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo registrar la ficha."); } finally { setSaving(false); }
  };

  if (!publicToken && !shortCode) return <PublicShell title="Enlace inválido" message="El enlace de registro no tiene código." />;
  if (link === undefined) return <PublicShell title="Cargando registro" message="Validando enlace..." />;
  if (link === null) return <PublicShell title="Enlace no disponible" message="Pide a tu líder un nuevo enlace de registro." />;
  if (done) return <PublicShell title="Registro enviado" message="Gracias. Un líder revisará la ficha y se comunicará con la familia." />;

  return <main className="min-h-dvh bg-paper px-4 py-6 sm:py-10 text-ink"><div className="mx-auto w-full max-w-2xl"><div className="mb-5"><p className="text-xs font-bold uppercase text-clay">Ministerio de adolescentes</p><h1 className="font-display text-balance text-2xl sm:text-3xl font-bold mt-1">Registro básico de adolescentes</h1><p className="text-sm text-pretty text-ink/55 mt-2">Puede ser llenado por el adolescente, su padre, madre o apoderado.</p>{scopeLabel && <p className="text-sm font-semibold text-ink/65 mt-2">Asignación: {scopeLabel}</p>}</div>
    <form onSubmit={handleSubmit} className="bg-card rounded-card shadow-soft border border-ink/5 p-4 sm:p-6 space-y-4">{error && <div className="rounded-xl border border-coral-100 bg-coral-50 px-3 py-2 text-sm font-medium text-coral-700">{error}</div>}
      <SelectField label="¿Quién completa este registro?" value={form.completedBy} onChange={set("completedBy")} options={COMPLETED_BY_OPTIONS.map(option => ({ value: option.value, label: option.label }))} />
      {isGeneral && <div className="grid sm:grid-cols-2 gap-3"><SelectField label="Sede" value={form.campusId} onChange={changeCampus} required options={[{ value: "", label: "Selecciona una sede" }, ...(campuses || []).map((campus: any) => ({ value: campus._id, label: campus.name }))]} /><SelectField label="Ministerio" value={form.ministryId} onChange={changeMinistry} required disabled={!form.campusId} options={[{ value: "", label: form.campusId ? "Selecciona un ministerio" : "Primero selecciona una sede" }, ...(ministries || []).map((ministry: any) => ({ value: ministry._id, label: ministry.name }))]} /><div className="sm:col-span-2"><SelectField label="Grupo (opcional)" value={form.groupId} onChange={set("groupId")} disabled={!form.ministryId} options={[{ value: "", label: "Sin grupo asignado" }, ...(groups || []).map((group: any) => ({ value: group._id, label: group.name }))]} /></div></div>}
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Nombre" value={form.nombre} onChange={set("nombre")} required /><Field label="Apellidos" value={form.apellido} onChange={set("apellido")} required /></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Fecha de nacimiento" type="date" value={form.nacimiento} onChange={set("nacimiento")} /><Field label="Edad aproximada" inputMode="numeric" value={form.edadAproximada} onChange={set("edadAproximada")} placeholder="Ej: 14" /></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Teléfono del adolescente" type="tel" inputMode="tel" value={form.telefono} onChange={v => set("telefono")(normalizePhone(v))} /><Field label="Contacto del apoderado" type="tel" inputMode="tel" value={form.telefonoPadre} onChange={v => set("telefonoPadre")(normalizePhone(v))} required /></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Nombre del apoderado" value={form.nombreEncargado} onChange={set("nombreEncargado")} /><Field label="Parentesco" value={form.parentescoEncargado} onChange={set("parentescoEncargado")} placeholder="Ej: madre, padre, tutor" /></div>
      <div className="grid sm:grid-cols-2 gap-3"><Field label="Quién lo invitó" value={form.invitadoPor} onChange={set("invitadoPor")} /><SelectField label="Fuente de ingreso" value={form.fuenteIngreso} onChange={set("fuenteIngreso")} options={SOURCE_OPTIONS} /></div>
      <label className="block"><span className="text-xs font-bold uppercase text-ink/45">Observación inicial</span><textarea value={form.observacionInicial} onChange={event => set("observacionInicial")(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-ink/10 bg-card px-3 py-2 text-sm outline-none focus:border-clay" placeholder="Información que ayude al líder a acompañar mejor a la familia" /></label>
      {form.completedBy === "guardian" ? <div className="space-y-2 rounded-xl bg-ink/[0.03] border border-ink/5 p-3"><p className="text-xs text-ink/55">Como apoderado, puede autorizar el uso administrativo y pastoral de estos datos.</p><Checkbox label="Autorizo el tratamiento pastoral y administrativo de estos datos." checked={form.consentimientoDatos} onChange={set("consentimientoDatos")} /><Checkbox label="Autorizo el uso de fotografía en actividades del ministerio." checked={form.consentimientoFoto} onChange={set("consentimientoFoto")} /></div> : <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">Las autorizaciones de datos y fotografía quedarán pendientes para confirmación del apoderado.</div>}
      <button disabled={saving} className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "Enviando..." : "Enviar registro"}</button>
    </form></div></main>;
}

function PublicShell({ title, message }: { title: string; message: string }) { return <main className="min-h-dvh bg-paper px-4 py-10 text-ink flex items-center justify-center"><div className="bg-card rounded-card shadow-soft border border-ink/5 p-6 max-w-md text-center"><h1 className="font-display text-balance text-2xl font-bold">{title}</h1><p className="text-sm text-pretty text-ink/55 mt-2">{message}</p></div></main>; }
function Field({ label, value, onChange, type = "text", required = false, placeholder, inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) { return <label className="block"><span className="text-xs font-bold uppercase text-ink/45">{label}</span><input type={type} required={required} value={value} inputMode={inputMode} placeholder={placeholder} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-card px-3 py-2.5 text-sm outline-none focus:border-clay" /></label>; }
function SelectField({ label, value, onChange, options, required = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean; disabled?: boolean }) { return <label className="block"><span className="text-xs font-bold uppercase text-ink/45">{label}</span><select value={value} required={required} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-card px-3 py-2.5 text-sm outline-none focus:border-clay disabled:bg-ink/[0.03]">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-start gap-2 text-sm text-ink/65"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-ink/20 text-clay" /><span>{label}</span></label>; }
