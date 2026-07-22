import assert from "node:assert/strict";
import {
  normalizePublicPhone,
  shouldAskInviter,
  validatePublicRegistration,
} from "../src/lib/publicTeenRegistration.ts";

const base = {
  completedBy: "teen",
  campusId: "campus",
  ministryId: "ministry",
  nombre: "Ana",
  apellido: "Torres",
  nacimiento: "2012-05-10",
  birthDateUnknown: false,
  edadAproximada: "",
  telefono: "",
  telefonoPadre: "999 888 777",
  nombreEncargado: "",
  parentescoEncargado: "",
  fuenteIngreso: "culto",
  consentimientoDatos: false,
};

assert.deepEqual(validatePublicRegistration(base, true, "2026-07-22"), {});
assert.equal(validatePublicRegistration({ ...base, completedBy: "" }, false).completedBy, "Selecciona quién completa el registro.");
assert.equal(validatePublicRegistration({ ...base, campusId: "" }, true).campusId, "Selecciona una sede.");
assert.equal(validatePublicRegistration({ ...base, completedBy: "guardian" }, false).nombreEncargado, "Ingresa tu nombre.");
assert.equal(validatePublicRegistration({ ...base, completedBy: "guardian", nombreEncargado: "Rosa", parentescoEncargado: "Madre" }, false).consentimientoDatos, "Debes autorizar el tratamiento de datos para enviar el registro.");
assert.deepEqual(validatePublicRegistration({ ...base, completedBy: "guardian", nombreEncargado: "Rosa", parentescoEncargado: "Madre", consentimientoDatos: true }, false), {});
assert.equal(validatePublicRegistration({ ...base, birthDateUnknown: true, nacimiento: "", edadAproximada: "0" }, false).edadAproximada, "Ingresa una edad entre 1 y 99 años.");
assert.equal(validatePublicRegistration({ ...base, nacimiento: "2026-02-31" }, false).nacimiento, "Ingresa una fecha válida.");
assert.equal(validatePublicRegistration({ ...base, nacimiento: "2026-07-23" }, false, "2026-07-22").nacimiento, "La fecha de nacimiento no puede estar en el futuro.");
assert.equal(validatePublicRegistration({ ...base, telefonoPadre: "123" }, false).telefonoPadre, "El teléfono debe tener entre 8 y 15 dígitos.");
assert.equal(validatePublicRegistration({ ...base, fuenteIngreso: "" }, false).fuenteIngreso, "Selecciona cómo conoció el ministerio.");
assert.equal(shouldAskInviter("amigo"), true);
assert.equal(shouldAskInviter("familiar"), true);
assert.equal(shouldAskInviter("culto"), false);
assert.equal(normalizePublicPhone("+51 abc 999   888-777"), "+51 999 888-777");

console.log("Public teen registration validation OK.");
