import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  normalizePublicPhone,
  shouldAskInviter,
  validatePublicRegistration,
  type PublicRegistrationCompletedBy,
  type PublicRegistrationFieldErrors,
  type PublicRegistrationFormValues,
  type PublicRegistrationSource,
} from "../lib/publicTeenRegistration";

const SOURCE_OPTIONS = [
  { value: "", label: "Selecciona una opción" },
  { value: "amigo", label: "Por un amigo" },
  { value: "familiar", label: "Por un familiar" },
  { value: "culto", label: "En un culto" },
  { value: "campaña", label: "En una campaña" },
  { value: "escuela_biblica", label: "En la escuela bíblica" },
  { value: "otro", label: "De otra manera" },
];

const COMPLETED_BY_OPTIONS = [
  { value: "", label: "Selecciona una opción" },
  { value: "teen", label: "El adolescente" },
  { value: "guardian", label: "Padre, madre o apoderado" },
  { value: "leader", label: "Un líder del ministerio" },
];

type RegistrationForm = PublicRegistrationFormValues & {
  groupId: string;
  invitadoPor: string;
  observacionInicial: string;
  consentimientoFoto: boolean;
};

const INITIAL_FORM: RegistrationForm = {
  completedBy: "",
  campusId: "",
  ministryId: "",
  groupId: "",
  nombre: "",
  apellido: "",
  nacimiento: "",
  birthDateUnknown: false,
  edadAproximada: "",
  telefono: "",
  telefonoPadre: "",
  nombreEncargado: "",
  parentescoEncargado: "",
  invitadoPor: "",
  fuenteIngreso: "",
  observacionInicial: "",
  consentimientoDatos: false,
  consentimientoFoto: false,
};

function localDateValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function formatDestination(campusName?: string, ministryName?: string, groupName?: string) {
  const campus = campusName?.replace(/^Congregación Cristo Vive\s*[-–]\s*/i, "Sede ").trim();
  const location = campus?.replace(/^Sede\s+/i, "").trim();
  let ministry = ministryName?.replace(/^Ministerio de\s+/i, "").trim();
  const repeatedLocation = location ? ` - ${location}` : "";
  if (ministry && repeatedLocation && ministry.toLocaleLowerCase().endsWith(repeatedLocation.toLocaleLowerCase())) {
    ministry = ministry.slice(0, -repeatedLocation.length).trim();
  }
  return [ministry, campus, groupName].filter(Boolean).join(" · ");
}

export default function PublicTeenRegistration({ publicToken, shortCode }: { publicToken: string; shortCode: string }) {
  const linkArgs = { publicToken: publicToken || undefined, shortCode: shortCode || undefined };
  const link = useQuery(api.teens.getPublicRegistrationLink, publicToken || shortCode ? linkArgs : "skip");
  const campuses = useQuery(api.teens.listPublicRegistrationCampuses, link?.scopeMode === "general" ? linkArgs : "skip");
  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);
  const ministries = useQuery(api.teens.listPublicRegistrationMinistries, link?.scopeMode === "general" && form.campusId ? { ...linkArgs, campusId: form.campusId as any } : "skip");
  const groups = useQuery(api.teens.listPublicRegistrationGroups, link?.scopeMode === "general" && form.ministryId ? { ...linkArgs, ministryId: form.ministryId as any } : "skip");
  const submit = useMutation(api.teens.submitPublicRegistration);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PublicRegistrationFieldErrors>({});
  const [done, setDone] = useState(false);
  const isGeneral = link?.scopeMode === "general";
  const isGuardian = form.completedBy === "guardian";
  const asksInviter = shouldAskInviter(form.fuenteIngreso);

  const destination = useMemo(() => {
    if (!link) return "";
    if (!isGeneral) return formatDestination(link.campusName, link.ministryName, link.groupName);
    const campus = campuses?.find((item: any) => String(item._id) === form.campusId);
    const ministry = ministries?.find((item: any) => String(item._id) === form.ministryId);
    const group = groups?.find((item: any) => String(item._id) === form.groupId);
    return formatDestination(campus?.name, ministry?.name, group?.name);
  }, [campuses, form.campusId, form.groupId, form.ministryId, groups, isGeneral, link, ministries]);

  const updateField = <K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const changeCompletedBy = (value: string) => {
    const completedBy = value as PublicRegistrationCompletedBy;
    setForm((current) => ({
      ...current,
      completedBy,
      consentimientoDatos: completedBy === "guardian" ? current.consentimientoDatos : false,
      consentimientoFoto: completedBy === "guardian" ? current.consentimientoFoto : false,
    }));
    setFieldErrors((current) => ({ ...current, completedBy: undefined, nombreEncargado: undefined, parentescoEncargado: undefined, consentimientoDatos: undefined }));
  };

  const changeBirthDateMode = (unknown: boolean) => {
    setForm((current) => ({ ...current, birthDateUnknown: unknown, nacimiento: unknown ? "" : current.nacimiento, edadAproximada: unknown ? current.edadAproximada : "" }));
    setFieldErrors((current) => ({ ...current, nacimiento: undefined, edadAproximada: undefined }));
  };

  const changeSource = (value: string) => {
    const fuenteIngreso = value as PublicRegistrationSource;
    setForm((current) => ({ ...current, fuenteIngreso, invitadoPor: shouldAskInviter(fuenteIngreso) ? current.invitadoPor : "" }));
    setFieldErrors((current) => ({ ...current, fuenteIngreso: undefined }));
  };

  const changeCampus = (value: string) => {
    setForm((current) => ({ ...current, campusId: value, ministryId: "", groupId: "" }));
    setFieldErrors((current) => ({ ...current, campusId: undefined, ministryId: undefined }));
  };

  const changeMinistry = (value: string) => {
    setForm((current) => ({ ...current, ministryId: value, groupId: "" }));
    setFieldErrors((current) => ({ ...current, ministryId: undefined }));
  };

  const focusFirstError = (errors: PublicRegistrationFieldErrors) => {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    requestAnimationFrame(() => document.getElementById(`registration-${firstKey}`)?.focus());
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setGlobalError("");
    const errors = validatePublicRegistration(form, Boolean(isGeneral), localDateValue());
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }

    setSaving(true);
    try {
      await submit({
        ...linkArgs,
        campusId: isGeneral ? form.campusId as any : undefined,
        ministryId: isGeneral ? form.ministryId as any : undefined,
        groupId: isGeneral && form.groupId ? form.groupId as any : undefined,
        completedBy: form.completedBy as Exclude<PublicRegistrationCompletedBy, "">,
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        nacimiento: form.birthDateUnknown || !form.nacimiento ? undefined : form.nacimiento,
        edadAproximada: form.birthDateUnknown ? form.edadAproximada.trim() : undefined,
        telefono: form.telefono.trim() || undefined,
        telefonoPadre: form.telefonoPadre.trim(),
        nombreEncargado: form.nombreEncargado.trim() || undefined,
        parentescoEncargado: form.parentescoEncargado.trim() || undefined,
        invitadoPor: asksInviter ? form.invitadoPor.trim() || undefined : undefined,
        fuenteIngreso: form.fuenteIngreso as Exclude<PublicRegistrationSource, "">,
        observacionInicial: form.observacionInicial.trim() || undefined,
        consentimientoDatos: isGuardian ? form.consentimientoDatos : false,
        consentimientoFoto: isGuardian ? form.consentimientoFoto : false,
      });
      setDone(true);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "No se pudo registrar la ficha.");
    } finally {
      setSaving(false);
    }
  };

  if (!publicToken && !shortCode) return <PublicShell title="Enlace inválido" message="El enlace de registro no tiene código." />;
  if (link === undefined) return <PublicShell title="Cargando registro" message="Validando enlace..." />;
  if (link === null) return <PublicShell title="Enlace no disponible" message="Pide a tu líder un nuevo enlace de registro." />;
  if (done) return <PublicShell title="Registro enviado" destination={destination} message="Un líder revisará la información y se comunicará con la familia." detail="Puedes cerrar esta ventana." />;

  return (
    <main className="min-h-dvh bg-paper px-4 py-6 text-ink sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Ministerio de adolescentes</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-balance sm:text-3xl">Registro básico de adolescentes</h1>
          <p className="mt-2 text-sm text-ink/65">Completarlo toma aproximadamente 2 minutos.</p>
          {destination && <p className="mt-2 text-sm font-semibold text-ink/75">Se registrará en: {destination}</p>}
        </header>

        <form onSubmit={handleSubmit} noValidate aria-busy={saving} className="space-y-6 rounded-card border border-ink/5 bg-card p-4 shadow-soft sm:p-6">
          <p className="text-sm text-ink/65">Los campos con <span aria-hidden="true">*</span><span className="sr-only">asterisco</span> son obligatorios.</p>
          {globalError && <div role="alert" className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">{globalError}</div>}

          <FormSection title="Quién completa el registro">
            <SelectField id="registration-completedBy" label="¿Quién completa este registro?" value={form.completedBy} onChange={changeCompletedBy} options={COMPLETED_BY_OPTIONS} required error={fieldErrors.completedBy} />
          </FormSection>

          {isGeneral && (
            <FormSection title="Destino del registro">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField id="registration-campusId" label="Sede" value={form.campusId} onChange={changeCampus} required error={fieldErrors.campusId} options={[{ value: "", label: "Selecciona una sede" }, ...(campuses || []).map((campus: any) => ({ value: campus._id, label: campus.name }))]} />
                <SelectField id="registration-ministryId" label="Ministerio" value={form.ministryId} onChange={changeMinistry} required disabled={!form.campusId} error={fieldErrors.ministryId} options={[{ value: "", label: form.campusId ? "Selecciona un ministerio" : "Primero selecciona una sede" }, ...(ministries || []).map((ministry: any) => ({ value: ministry._id, label: ministry.name }))]} />
                <div className="sm:col-span-2">
                  <SelectField id="registration-groupId" label="Grupo (opcional)" value={form.groupId} onChange={(value) => updateField("groupId", value)} disabled={!form.ministryId} options={[{ value: "", label: "Sin grupo asignado" }, ...(groups || []).map((group: any) => ({ value: group._id, label: group.name }))]} />
                </div>
              </div>
            </FormSection>
          )}

          <FormSection title="Datos del adolescente">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="registration-nombre" label="Nombre" value={form.nombre} onChange={(value) => updateField("nombre", value)} required error={fieldErrors.nombre} autoComplete="given-name" />
              <Field id="registration-apellido" label="Apellidos" value={form.apellido} onChange={(value) => updateField("apellido", value)} required error={fieldErrors.apellido} autoComplete="family-name" />
            </div>
            {!form.birthDateUnknown && <Field id="registration-nacimiento" label="Fecha de nacimiento (opcional)" type="date" max={localDateValue()} value={form.nacimiento} onChange={(value) => updateField("nacimiento", value)} error={fieldErrors.nacimiento} />}
            <Checkbox id="registration-birthDateUnknown" label="No conozco la fecha exacta" checked={form.birthDateUnknown} onChange={changeBirthDateMode} />
            {form.birthDateUnknown && <Field id="registration-edadAproximada" label="Edad aproximada" type="number" inputMode="numeric" min="1" max="99" value={form.edadAproximada} onChange={(value) => updateField("edadAproximada", value)} required error={fieldErrors.edadAproximada} placeholder="Ej. 14" />}
            <Field id="registration-telefono" label="Celular del adolescente (opcional)" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono} onChange={(value) => updateField("telefono", normalizePublicPhone(value))} error={fieldErrors.telefono} />
          </FormSection>

          <FormSection title="Contacto familiar">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="registration-nombreEncargado" label={isGuardian ? "Tu nombre" : "Nombre del apoderado (opcional)"} value={form.nombreEncargado} onChange={(value) => updateField("nombreEncargado", value)} required={isGuardian} error={fieldErrors.nombreEncargado} autoComplete="name" />
              <Field id="registration-parentescoEncargado" label={isGuardian ? "Tu parentesco con el adolescente" : "Parentesco (opcional)"} value={form.parentescoEncargado} onChange={(value) => updateField("parentescoEncargado", value)} required={isGuardian} error={fieldErrors.parentescoEncargado} placeholder="Ej. madre, padre o tutor" />
            </div>
            <Field id="registration-telefonoPadre" label={isGuardian ? "Tu celular o WhatsApp" : "Celular del apoderado"} type="tel" inputMode="tel" autoComplete="tel" value={form.telefonoPadre} onChange={(value) => updateField("telefonoPadre", normalizePublicPhone(value))} required error={fieldErrors.telefonoPadre} />
          </FormSection>

          <FormSection title="Cómo conoció el ministerio">
            <SelectField id="registration-fuenteIngreso" label="¿Cómo conoció el ministerio?" value={form.fuenteIngreso} onChange={changeSource} options={SOURCE_OPTIONS} required error={fieldErrors.fuenteIngreso} />
            {asksInviter && <Field id="registration-invitadoPor" label="¿Quién lo invitó? (opcional)" value={form.invitadoPor} onChange={(value) => updateField("invitadoPor", value)} />}
            <details className="group rounded-xl border border-ink/10 bg-card">
              <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2.5 text-sm font-semibold text-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600">Agregar una nota para el líder (opcional)</summary>
              <div className="px-3 pb-3">
                <TextArea id="registration-observacionInicial" label="Nota para el líder" value={form.observacionInicial} onChange={(value) => updateField("observacionInicial", value)} placeholder="Información que ayude al líder a acompañar mejor a la familia" />
              </div>
            </details>
          </FormSection>

          <FormSection title="Autorizaciones">
            {isGuardian ? (
              <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.025] p-3">
                <p className="text-sm text-ink/65">Como apoderado, puedes autorizar el uso administrativo y pastoral de estos datos.</p>
                <Checkbox id="registration-consentimientoDatos" label="Autorizo el tratamiento pastoral y administrativo de estos datos." checked={form.consentimientoDatos} onChange={(value) => updateField("consentimientoDatos", value)} required error={fieldErrors.consentimientoDatos} />
                <Checkbox id="registration-consentimientoFoto" label="Autorizo el uso de fotografía en actividades del ministerio (opcional)." checked={form.consentimientoFoto} onChange={(value) => updateField("consentimientoFoto", value)} />
              </div>
            ) : (
              <div className="rounded-xl border border-warning-100 bg-warning-50 px-3 py-3 text-sm text-warning-800">Las autorizaciones de datos y fotografía quedarán pendientes para confirmación del apoderado.</div>
            )}
          </FormSection>

          <button type="submit" disabled={saving} className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white outline-none transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
            {saving ? "Enviando…" : "Enviar registro"}
          </button>
        </form>
      </div>
    </main>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="space-y-4 border-t border-ink/10 pt-5"><legend className="px-1 text-base font-bold text-ink">{title}</legend>{children}</fieldset>;
}

function PublicShell({ title, message, destination, detail }: { title: string; message: string; destination?: string; detail?: string }) {
  return <main className="flex min-h-dvh items-center justify-center bg-paper px-4 py-10 text-ink"><div className="max-w-md rounded-card border border-ink/5 bg-card p-6 text-center shadow-soft"><h1 className="font-display text-2xl font-bold text-balance">{title}</h1>{destination && <p className="mt-3 text-sm font-semibold text-ink/75">Se registró en: {destination}</p>}<p className="mt-2 text-sm text-ink/65 text-pretty">{message}</p>{detail && <p className="mt-2 text-sm text-ink/55">{detail}</p>}</div></main>;
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  min?: string;
  max?: string;
  error?: string;
};

function Field({ id, label, value, onChange, type = "text", required = false, placeholder, inputMode, autoComplete, min, max, error }: FieldProps) {
  const errorId = `${id}-error`;
  return <label className="block"><span className="text-sm font-semibold text-ink/75">{label}{required && <span className="text-danger-600" aria-hidden="true"> *</span>}</span><input id={id} type={type} required={required} aria-required={required || undefined} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} value={value} inputMode={inputMode} autoComplete={autoComplete} min={min} max={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-ink/15 bg-card px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/45 focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-600/25" />{error && <span id={errorId} className="mt-1 block text-sm font-medium text-danger-700">{error}</span>}</label>;
}

function SelectField({ id, label, value, onChange, options, required = false, disabled = false, error }: { id: string; label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean; disabled?: boolean; error?: string }) {
  const errorId = `${id}-error`;
  return <label className="block"><span className="text-sm font-semibold text-ink/75">{label}{required && <span className="text-danger-600" aria-hidden="true"> *</span>}</span><select id={id} value={value} required={required} disabled={disabled} aria-required={required || undefined} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-ink/15 bg-card px-3 py-2.5 text-sm text-ink outline-none focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-600/25 disabled:cursor-not-allowed disabled:bg-ink/[0.03] disabled:text-ink/45">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error && <span id={errorId} className="mt-1 block text-sm font-medium text-danger-700">{error}</span>}</label>;
}

function TextArea({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="text-sm font-semibold text-ink/75">{label}</span><textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-ink/15 bg-card px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/45 focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-600/25" placeholder={placeholder} /></label>;
}

function Checkbox({ id, label, checked, onChange, required = false, error }: { id: string; label: string; checked: boolean; onChange: (value: boolean) => void; required?: boolean; error?: string }) {
  const errorId = `${id}-error`;
  return <div><label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg py-2 text-sm text-ink/75"><input id={id} type="checkbox" checked={checked} required={required} aria-required={required || undefined} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/25 text-primary-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2" /><span>{label}{required && <span className="text-danger-600" aria-hidden="true"> *</span>}</span></label>{error && <p id={errorId} className="text-sm font-medium text-danger-700">{error}</p>}</div>;
}
