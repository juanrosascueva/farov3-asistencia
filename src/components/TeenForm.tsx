import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { SpiritualStage, TeenStatus } from "../lib/types";
import {
  normalizePhoneInput,
  teenProfileCompleteness,
  TEEN_STATUS_META,
  SPIRITUAL_STAGE_LABELS,
} from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { useScopes } from "../hooks/useScopes";
import ResponsiveSheet from "./ResponsiveSheet";
import ImageUploader from "./ImageUploader";

const DRAFT_KEY = "teen_form_draft_v2";
const FORM_ID = "teen-pastoral-form";

const empty = {
  nombre: "",
  apellido: "",
  nacimiento: "",
  sexo: "prefiero_no_decir",
  telefono: "",
  telefonoPadre: "",
  telefonoSecundario: "",
  nombreEncargado: "",
  parentescoEncargado: "",
  contactoEmergenciaNombre: "",
  contactoEmergenciaTelefono: "",
  permiteMensajes: true,
  gustos: "",
  observacionInicial: "",
  foto: "",
  fechaIngreso: "",
  estado: "activo" as TeenStatus,
  motivoInactividad: "",
  colegio: "",
  gradoEscolar: "",
  barrio: "",
  viveCon: "",
  decisionEspiritual: "conociendo" as SpiritualStage,
  requiereSeguimientoEspecial: false,
  consentimientoDatos: false,
  consentimientoFoto: false,
  fechaConsentimiento: "",
};

const STEPS = [
  { id: "identidad", label: "Identidad" },
  { id: "familia", label: "Familia" },
  { id: "ministerio", label: "Ministerio" },
  { id: "pastoral", label: "Pastoral" },
  { id: "consentimiento", label: "Consentimientos" },
] as const;

interface TeenFormProps {
  teen?: Doc<"teens">;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TeenForm({ teen, onClose, onSuccess }: TeenFormProps) {
  const { token, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  const initialForm = useMemo(() => {
    if (teen) {
      return {
        nombre: teen.nombre,
        apellido: teen.apellido,
        nacimiento: teen.nacimiento,
        sexo: teen.sexo || "prefiero_no_decir",
        telefono: teen.telefono,
        telefonoPadre: teen.telefonoPadre,
        telefonoSecundario: teen.telefonoSecundario || "",
        nombreEncargado: teen.nombreEncargado || "",
        parentescoEncargado: teen.parentescoEncargado || "",
        contactoEmergenciaNombre: teen.contactoEmergenciaNombre || "",
        contactoEmergenciaTelefono: teen.contactoEmergenciaTelefono || "",
        permiteMensajes: teen.permiteMensajes ?? true,
        gustos: teen.gustos,
        observacionInicial: teen.observacionInicial || teen.notas || "",
        foto: teen.foto,
        fechaIngreso: teen.fechaIngreso || "",
        estado: teen.estado || "activo",
        motivoInactividad: teen.motivoInactividad || "",
        colegio: teen.colegio || "",
        gradoEscolar: teen.gradoEscolar || "",
        barrio: teen.barrio || "",
        viveCon: teen.viveCon || "",
        decisionEspiritual: teen.decisionEspiritual || "conociendo",
        requiereSeguimientoEspecial: teen.requiereSeguimientoEspecial || false,
        consentimientoDatos: teen.consentimientoDatos || false,
        consentimientoFoto: teen.consentimientoFoto || false,
        fechaConsentimiento: teen.fechaConsentimiento || "",
      };
    }
    return { ...empty };
  }, [teen]);

  const [form, setForm] = useState(initialForm);
  const [campusId, setCampusId] = useState<string>(teen?.campusId || "");
  const [ministryId, setMinistryId] = useState<string>(teen?.ministryId || "");
  const [groupId, setGroupId] = useState<string>(teen?.groupId || "");
  const [fotoStorageId, setFotoStorageId] = useState<string>(teen?.fotoStorageId || "");

  useEffect(() => {
    if (teen) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setForm((prev) => ({ ...prev, ...draft.form }));
      setCampusId(draft.campusId || "");
      setMinistryId(draft.ministryId || "");
      setGroupId(draft.groupId || "");
      setFotoStorageId(draft.fotoStorageId || "");
      setStep(draft.step || 0);
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [teen]);

  useEffect(() => {
    if (teen) return;
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form, campusId, ministryId, groupId, step, fotoStorageId })
    );
  }, [teen, form, campusId, ministryId, groupId, step]);

  const rawCampuses = useQuery(api.campus.list, user && token ? { token } : "skip");
  const rawMinistries = useQuery(
    api.ministry.list,
    user && token && campusId ? { token, campusId: campusId as any } : "skip"
  );
  const rawGroups = useQuery(
    api.group.list,
    user && token && ministryId ? { token, ministryId: ministryId as any } : "skip"
  );

  const { filterCampuses, filterMinistries, filterGroups } = useScopes();

  const campuses = useMemo(() => filterCampuses(rawCampuses), [rawCampuses, filterCampuses]);
  const ministries = useMemo(() => filterMinistries(rawMinistries, campusId), [rawMinistries, filterMinistries, campusId]);
  const groups = useMemo(() => filterGroups(rawGroups, campusId, ministryId), [rawGroups, filterGroups, campusId, ministryId]);

  const duplicateMatches = useQuery(
    api.teens.detectDuplicates,
    form.nombre.trim() && form.apellido.trim()
      ? {
          nombre: form.nombre,
          apellido: form.apellido,
          telefono: form.telefono,
          telefonoPadre: form.telefonoPadre,
          excludeId: teen?._id,
        }
      : "skip"
  ) as
    | { teenId: string; nombre: string; apellido: string; reasons: string[] }[]
    | undefined;

  const createTeen = useMutation(api.teens.create);
  const updateTeen = useMutation(api.teens.update);

  const completeness = teenProfileCompleteness({ ...form, campusId, ministryId, groupId });

  const stepErrors = useMemo(() => {
    const errors: string[] = [];
    if (step === 0) {
      if (!form.nombre.trim()) errors.push("Ingresa el nombre.");
      if (!form.apellido.trim()) errors.push("Ingresa el apellido.");
      if (form.nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(form.nacimiento)) errors.push("La fecha de nacimiento no es válida.");
    }
    if (step === 1) {
      if (!form.nombreEncargado.trim()) errors.push("Agrega el nombre del encargado principal.");
      if (!form.telefonoPadre.trim() && !form.contactoEmergenciaTelefono.trim()) errors.push("Agrega al menos un contacto familiar.");
    }
    if (step === 2) {
      if (!campusId) errors.push("Selecciona una sede.");
    }
    if (step === 4) {
      if (form.consentimientoDatos && !form.fechaConsentimiento) errors.push("Registra la fecha del consentimiento de datos.");
    }
    return errors;
  }, [step, form, campusId]);

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const closeAndReset = () => {
    if (!teen) localStorage.removeItem(DRAFT_KEY);
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: normalizePhoneInput(form.telefono),
        telefonoPadre: normalizePhoneInput(form.telefonoPadre),
        telefonoSecundario: normalizePhoneInput(form.telefonoSecundario),
        contactoEmergenciaTelefono: normalizePhoneInput(form.contactoEmergenciaTelefono),
        observacionInicial: form.observacionInicial.trim(),
        gustos: form.gustos.trim(),
        notas: "",
        campusId: campusId ? (campusId as any) : undefined,
        ministryId: ministryId ? (ministryId as any) : undefined,
        groupId: groupId ? (groupId as any) : undefined,
        fotoStorageId: fotoStorageId ? (fotoStorageId as any) : undefined,
        token: token ?? undefined,
      };
      if (teen) {
        await updateTeen({ id: teen._id, ...(payload as any) });
      } else {
        await createTeen(payload as any);
        localStorage.removeItem(DRAFT_KEY);
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la ficha pastoral.");
    } finally {
      setSubmitting(false);
    }
  };

  const canGoNext = stepErrors.length === 0;
  const mobileProgress = (
    <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-3.5 sm:hidden">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">Paso {step + 1} de {STEPS.length}</span>
        <span className="text-ink/50 truncate">{STEPS[step].label}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStep(index)}
            className={`flex-1 h-2 rounded-full transition ${
              index <= step ? "bg-teal-600" : "bg-ink/10"
            }`}
            aria-label={`Ir a paso ${item.label}`}
          />
        ))}
      </div>
    </div>
  );

  const footer = (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
      <button type="button" onClick={closeAndReset} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 w-full sm:w-auto order-3 sm:order-none">
        Cancelar
      </button>
      {!teen && (
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(DRAFT_KEY);
            setForm({ ...empty });
            setCampusId("");
            setMinistryId("");
            setGroupId("");
            setFotoStorageId("");
            setStep(0);
          }}
          className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/45 w-full sm:w-auto order-4 sm:order-none"
        >
          Limpiar borrador
        </button>
      )}
      {step > 0 && (
        <button type="button" onClick={() => setStep((s) => s - 1)} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 w-full sm:w-auto order-2 sm:order-none">
          Atrás
        </button>
      )}
      {step < STEPS.length - 1 ? (
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => setStep((s) => s + 1)}
          className="rounded-xl bg-ink text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40 w-full sm:w-auto order-1 sm:order-none"
        >
          Siguiente
        </button>
      ) : (
        <button
          type="submit"
          form={FORM_ID}
          disabled={submitting || stepErrors.length > 0}
          className="rounded-xl bg-ink text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 w-full sm:w-auto order-1 sm:order-none"
        >
          {submitting && (
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {submitting ? "Guardando..." : teen ? "Guardar ficha" : "Registrar adolescente"}
        </button>
      )}
    </div>
  );

  return (
    <ResponsiveSheet
      title={teen ? "Editar ficha pastoral" : "Registrar adolescente"}
      onClose={closeAndReset}
      desktopMaxWidthClass="sm:max-w-4xl"
      progress={mobileProgress}
      footer={footer}
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 h-full">
        <div className="hidden sm:flex sm:flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                    step === index
                      ? "bg-teal-600 text-white border-teal-600"
                      : index < step
                      ? "bg-teal-50 text-teal-700 border-teal-100"
                      : "bg-card text-ink/50 border-ink/10"
                  }`}
                >
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                    {index + 1}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="text-sm text-ink/55">
              Perfil completo: <span className="font-semibold text-ink">{completeness.percent}%</span>
            </div>
        </div>

        {duplicateMatches && duplicateMatches.length > 0 && !teen && (
          <details className="rounded-2xl border border-amber-200 bg-amber-50 p-4 group">
            <summary className="list-none cursor-pointer flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-800">Posibles duplicados detectados</p>
                <p className="text-xs text-amber-800/80 mt-1">{duplicateMatches.length} coincidencia{duplicateMatches.length > 1 ? "s" : ""} encontrada{duplicateMatches.length > 1 ? "s" : ""}.</p>
              </div>
              <span className="text-xs font-semibold text-amber-700 shrink-0 group-open:hidden">Ver</span>
            </summary>
            <div className="mt-3 space-y-2 text-xs text-amber-800/90">
              {duplicateMatches.map((match) => (
                <div key={match.teenId} className="rounded-xl bg-white/70 px-3 py-2 border border-amber-100">
                  <p className="font-semibold">{match.nombre} {match.apellido}</p>
                  <p>{match.reasons.join(" · ")}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {error && <Alert tone="red" message={error} />}
        {stepErrors.length > 0 && <Alert tone="amber" message={stepErrors[0]} />}

        {step === 0 && (
          <section className="space-y-4">
            <SectionHeader title="Identidad del adolescente" helper="Captura los datos base y evita dejar la fecha vacía si la conoces." />
            
            <div className="flex flex-col md:flex-row gap-5 items-center md:items-start bg-white/40 dark:bg-white/5 p-4 rounded-2xl border border-ink/5 shadow-sm">
              <div className="shrink-0 mt-1">
                <ImageUploader 
                  currentImageUrl={form.foto} 
                  onUploadComplete={(storageId, url) => {
                    setFotoStorageId(storageId);
                    set("foto")(url);
                  }}
                  label="Foto de Ficha"
                />
              </div>
              
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre" value={form.nombre} onChange={set("nombre")} required />
                  <Field label="Apellido" value={form.apellido} onChange={set("apellido")} required />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Fecha de nacimiento" type="date" value={form.nacimiento} onChange={set("nacimiento")} />
                  <SelectField label="Sexo" value={form.sexo} onChange={set("sexo")} options={[
                    { value: "prefiero_no_decir", label: "Prefiero no decir" },
                    { value: "masculino", label: "Masculino" },
                    { value: "femenino", label: "Femenino" },
                    { value: "otro", label: "Otro" },
                  ]} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Teléfono del adolescente" type="tel" inputMode="tel" value={form.telefono} onChange={(v) => set("telefono")(normalizePhoneInput(v))} />
              <Field label="Teléfono secundario" type="tel" inputMode="tel" value={form.telefonoSecundario} onChange={(v) => set("telefonoSecundario")(normalizePhoneInput(v))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Colegio" value={form.colegio} onChange={set("colegio")} />
              <Field label="Grado escolar" value={form.gradoEscolar} onChange={set("gradoEscolar")} placeholder="Ej: 2do secundaria" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Barrio / zona" value={form.barrio} onChange={set("barrio")} />
              <Field label="Vive con" value={form.viveCon} onChange={set("viveCon")} placeholder="Ej: madre y abuela" />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <SectionHeader title="Familia y contacto" helper="Deja al menos un adulto responsable con teléfono disponible." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre del encargado" value={form.nombreEncargado} onChange={set("nombreEncargado")} required />
              <Field label="Parentesco" value={form.parentescoEncargado} onChange={set("parentescoEncargado")} placeholder="Ej: madre, padre, tía" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Teléfono del encargado" type="tel" inputMode="tel" value={form.telefonoPadre} onChange={(v) => set("telefonoPadre")(normalizePhoneInput(v))} required />
              <Field label="Contacto de emergencia" value={form.contactoEmergenciaNombre} onChange={set("contactoEmergenciaNombre")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Teléfono de emergencia" type="tel" inputMode="tel" value={form.contactoEmergenciaTelefono} onChange={(v) => set("contactoEmergenciaTelefono")(normalizePhoneInput(v))} />
              <ToggleField label="Permite mensajes por WhatsApp" checked={form.permiteMensajes} onChange={(v) => set("permiteMensajes")(v)} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <SectionHeader title="Asignación ministerial" helper="La consistencia sede → ministerio → grupo se valida antes de guardar." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Fecha de ingreso" type="date" value={form.fechaIngreso} onChange={set("fechaIngreso")} />
              <SelectField
                label="Estado"
                value={form.estado}
                onChange={set("estado")}
                options={Object.entries(TEEN_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
              />
            </div>
            {form.estado !== "activo" && (
              <TextArea label="Motivo del estado actual" value={form.motivoInactividad} onChange={set("motivoInactividad")} rows={2} />
            )}
            <div className="space-y-3">
              <SelectField
                label="Sede"
                value={campusId}
                onChange={(v) => {
                  setCampusId(String(v));
                  setMinistryId("");
                  setGroupId("");
                }}
                options={[{ value: "", label: "Selecciona una sede" }, ...((campuses || []).map((c: any) => ({ value: c._id, label: c.name })))]}
              />
              {campusId && (
                <SelectField
                  label="Ministerio"
                  value={ministryId}
                  onChange={(v) => {
                    setMinistryId(String(v));
                    setGroupId("");
                  }}
                  options={[{ value: "", label: "Sin ministerio" }, ...((ministries || []).map((m: any) => ({ value: m._id, label: m.name })))]}
                />
              )}
              {ministryId && (
                <SelectField
                  label="Grupo"
                  value={groupId}
                  onChange={(v) => setGroupId(String(v))}
                  options={[{ value: "", label: "Sin grupo" }, ...((groups || []).map((g: any) => ({ value: g._id, label: g.name })))]}
                />
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <SectionHeader title="Contexto pastoral" helper="Usa esta sección para dejar claridad inicial; el seguimiento continuo debe vivir en la bitácora." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField
                label="Momento espiritual"
                value={form.decisionEspiritual}
                onChange={set("decisionEspiritual")}
                options={Object.entries(SPIRITUAL_STAGE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <ToggleField label="Requiere seguimiento especial" checked={form.requiereSeguimientoEspecial} onChange={(v) => set("requiereSeguimientoEspecial")(v)} />
            </div>
            <Field label="Gustos e intereses" value={form.gustos} onChange={set("gustos")} placeholder="Ej: música, deportes, dibujo" />
            <TextArea label="Observación inicial" value={form.observacionInicial} onChange={set("observacionInicial")} rows={4} helper="Contexto importante de ingreso. Para nuevas conversaciones usa la bitácora pastoral." />
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <SectionHeader title="Consentimientos y privacidad" helper="Ayuda a distinguir qué información puede gestionarse pastoralmente con respaldo familiar." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ToggleField label="Consentimiento de datos" checked={form.consentimientoDatos} onChange={(v) => set("consentimientoDatos")(v)} />
              <ToggleField label="Consentimiento de foto" checked={form.consentimientoFoto} onChange={(v) => set("consentimientoFoto")(v)} />
            </div>
            <Field label="Fecha de consentimiento" type="date" value={form.fechaConsentimiento} onChange={set("fechaConsentimiento")} />
            <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4 text-sm text-ink/65">
              Campos pendientes: {completeness.missing.length > 0 ? completeness.missing.join(" · ") : "ninguno"}.
            </div>
          </section>
        )}
      </form>
    </ResponsiveSheet>
  );
}

function SectionHeader({ title, helper }: { title: string; helper: string }) {
  return (
    <div>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="text-sm text-ink/50 mt-1">{helper}</p>
    </div>
  );
}

function Alert({ tone, message }: { tone: "amber" | "red"; message: string }) {
  const cls = tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800";
  return <div className={`rounded-2xl border p-3 text-sm ${cls}`}>{message}</div>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50 mb-1 block">{label}{required ? " *" : ""}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-base"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-base"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-ink/10 bg-card px-4 py-3 cursor-pointer">
      <span className="text-sm font-medium text-ink/70 pr-2">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition shrink-0 ${checked ? "bg-teal-600" : "bg-ink/15"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  helper?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50 mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-base resize-none"
      />
      {helper && <p className="text-[11px] text-ink/40 mt-1">{helper}</p>}
    </div>
  );
}
