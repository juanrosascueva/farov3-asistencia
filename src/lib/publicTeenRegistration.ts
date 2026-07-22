export type PublicRegistrationCompletedBy = "" | "teen" | "guardian" | "leader";
export type PublicRegistrationSource = "" | "amigo" | "familiar" | "culto" | "campaña" | "escuela_biblica" | "otro";

export interface PublicRegistrationFormValues {
  completedBy: PublicRegistrationCompletedBy;
  campusId: string;
  ministryId: string;
  nombre: string;
  apellido: string;
  nacimiento: string;
  birthDateUnknown: boolean;
  edadAproximada: string;
  telefono: string;
  telefonoPadre: string;
  nombreEncargado: string;
  parentescoEncargado: string;
  fuenteIngreso: PublicRegistrationSource;
  consentimientoDatos: boolean;
}

export type PublicRegistrationFieldErrors = Partial<Record<keyof PublicRegistrationFormValues, string>>;

export function normalizePublicPhone(value: string): string {
  return value.replace(/[^\d+()\-\s]/g, "").replace(/\s+/g, " ");
}

export function shouldAskInviter(source: PublicRegistrationSource): boolean {
  return source === "amigo" || source === "familiar";
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function phoneError(value: string, required: boolean): string | undefined {
  const digits = value.replace(/\D/g, "");
  if (!digits.length) return required ? "Ingresa el celular del apoderado." : undefined;
  if (digits.length < 8 || digits.length > 15) return "El teléfono debe tener entre 8 y 15 dígitos.";
  return undefined;
}

export function validatePublicRegistration(
  values: PublicRegistrationFormValues,
  isGeneral: boolean,
  today = new Date().toISOString().slice(0, 10),
): PublicRegistrationFieldErrors {
  const errors: PublicRegistrationFieldErrors = {};

  if (!values.completedBy) errors.completedBy = "Selecciona quién completa el registro.";
  if (isGeneral && !values.campusId) errors.campusId = "Selecciona una sede.";
  if (isGeneral && !values.ministryId) errors.ministryId = "Selecciona un ministerio.";
  if (values.nombre.trim().length < 2) errors.nombre = "El nombre debe tener al menos 2 caracteres.";
  if (values.apellido.trim().length < 2) errors.apellido = "Los apellidos deben tener al menos 2 caracteres.";

  if (values.birthDateUnknown) {
    const age = Number(values.edadAproximada);
    if (!/^\d+$/.test(values.edadAproximada) || !Number.isInteger(age) || age < 1 || age > 99) {
      errors.edadAproximada = "Ingresa una edad entre 1 y 99 años.";
    }
  } else if (values.nacimiento) {
    if (!isRealDate(values.nacimiento)) errors.nacimiento = "Ingresa una fecha válida.";
    else if (values.nacimiento > today) errors.nacimiento = "La fecha de nacimiento no puede estar en el futuro.";
  }

  const teenPhoneError = phoneError(values.telefono, false);
  if (teenPhoneError) errors.telefono = teenPhoneError;
  const guardianPhoneError = phoneError(values.telefonoPadre, true);
  if (guardianPhoneError) errors.telefonoPadre = guardianPhoneError;

  if (values.completedBy === "guardian") {
    if (!values.nombreEncargado.trim()) errors.nombreEncargado = "Ingresa tu nombre.";
    if (!values.parentescoEncargado.trim()) errors.parentescoEncargado = "Indica tu parentesco con el adolescente.";
    if (!values.consentimientoDatos) errors.consentimientoDatos = "Debes autorizar el tratamiento de datos para enviar el registro.";
  }

  if (!values.fuenteIngreso) errors.fuenteIngreso = "Selecciona cómo conoció el ministerio.";
  return errors;
}
