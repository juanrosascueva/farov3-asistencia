import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getEffectiveAccess, filterTeensByScope, requireAccess, canAccessTeen } from "./authz";
import { logAudit } from "./auditLog";
import { reassignOpenTasksForTeen, resolveEffectiveLeader } from "./leaderAssignment";

const teenStatus = v.union(
  v.literal("activo"),
  v.literal("visitante"),
  v.literal("nuevo"),
  v.literal("seguimiento"),
  v.literal("inactivo"),
  v.literal("trasladado"),
  v.literal("archivado"),
  v.literal("eliminado"),
  v.literal("egresado")
);

const sourceType = v.union(
  v.literal("amigo"),
  v.literal("familiar"),
  v.literal("campaña"),
  v.literal("culto"),
  v.literal("escuela_biblica"),
  v.literal("otro")
);

const integrationLevel = v.union(
  v.literal("nuevo"),
  v.literal("en_proceso"),
  v.literal("integrado"),
  v.literal("necesita_acompañamiento")
);

const spiritualStage = v.union(
  v.literal("nuevo"),
  v.literal("conociendo"),
  v.literal("afirmando_fe"),
  v.literal("bautizado"),
  v.literal("sirviendo")
);

const teenGender = v.union(
  v.literal("masculino"),
  v.literal("femenino"),
  v.literal("otro"),
  v.literal("prefiero_no_decir")
);

const optionalCampusId = v.optional(v.union(v.id("campus"), v.literal("")));
const optionalMinistryId = v.optional(v.union(v.id("ministry"), v.literal("")));
const optionalGroupId = v.optional(v.union(v.id("group"), v.literal("")));
const publicRegistrationScopeMode = v.union(v.literal("general"), v.literal("fixed"));
const publicRegistrationCompletedBy = v.union(v.literal("teen"), v.literal("guardian"), v.literal("leader"));

function newPublicToken(): string {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `reg_${uuid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)}`;
}

function newPublicShortCode(): string {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return uuid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
}

async function createUniquePublicShortCode(ctx: any): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const shortCode = newPublicShortCode();
    const existing = await ctx.db
      .query("publicRegistrationLinks")
      .withIndex("by_shortCode", (q: any) => q.eq("shortCode", shortCode))
      .first();
    if (!existing) return shortCode;
  }
  throw new Error("No se pudo generar un código corto. Intenta nuevamente.");
}

async function resolvePublicRegistrationLink(ctx: any, publicToken?: string, shortCode?: string) {
  if (shortCode) {
    const byShortCode = await ctx.db
      .query("publicRegistrationLinks")
      .withIndex("by_shortCode", (q: any) => q.eq("shortCode", shortCode.toLowerCase()))
      .first();
    if (byShortCode) return byShortCode;
  }
  if (publicToken) {
    return await ctx.db
      .query("publicRegistrationLinks")
      .withIndex("by_token", (q: any) => q.eq("token", publicToken))
      .first();
  }
  return null;
}

function cleanText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim().replace(/\s+/g, " ");
}

function cleanOptionalId(value: string | undefined): string | undefined {
  return value || undefined;
}

function normalizePhone(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/[^\d+()\-\s]/g, "").replace(/\s+/g, " ");
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw new Error("Los teléfonos deben tener entre 8 y 15 dígitos.");
  }
  return normalized;
}

function hasAnyContact(payload: any): boolean {
  return Boolean(payload.telefono || payload.telefonoPadre || payload.contactoEmergenciaTelefono);
}

function isCompleteProfile(payload: any): boolean {
  return Boolean(
    payload.nombre &&
    payload.apellido &&
    payload.campusId &&
    hasAnyContact(payload) &&
    payload.nombreEncargado &&
    payload.parentescoEncargado &&
    payload.nacimiento
  );
}

function isArchivedTeen(teen: any): boolean {
  return Boolean(teen.archivedAt || teen.deletedAt || teen.estado === "archivado" || teen.estado === "eliminado");
}

async function syncFamilyRecords(ctx: any, teenId: any, payload: any, userId?: any) {
  const now = new Date().toISOString();
  const existingGuardian = await ctx.db
    .query("guardians")
    .withIndex("by_teenId", (q: any) => q.eq("teenId", teenId))
    .first();
  const guardianPatch = {
    teenId,
    name: payload.nombreEncargado || "Encargado sin nombre",
    relationship: payload.parentescoEncargado,
    phone: payload.telefonoPadre,
    secondaryPhone: payload.telefonoSecundario,
    emergencyName: payload.contactoEmergenciaNombre,
    emergencyPhone: payload.contactoEmergenciaTelefono,
    isPrimary: true,
    canReceiveMessages: payload.permiteMensajes,
    updatedAt: now,
  };
  let guardianId = existingGuardian?._id;
  if (payload.nombreEncargado || payload.telefonoPadre || payload.contactoEmergenciaTelefono) {
    if (existingGuardian) {
      await ctx.db.patch(existingGuardian._id, guardianPatch);
    } else {
      guardianId = await ctx.db.insert("guardians", { ...guardianPatch, createdAt: now });
    }
  }

  for (const consent of [
    { type: "data" as const, granted: payload.consentimientoDatos },
    { type: "photo" as const, granted: payload.consentimientoFoto },
  ]) {
    const existingConsent = await ctx.db
      .query("consents")
      .withIndex("by_teen_type", (q: any) => q.eq("teenId", teenId).eq("type", consent.type))
      .first();
    const consentPatch = {
      teenId,
      type: consent.type,
      status: consent.granted ? "granted" as const : "pending" as const,
      guardianName: payload.nombreEncargado,
      guardianId,
      grantedAt: consent.granted ? payload.fechaConsentimiento || now.slice(0, 10) : undefined,
      recordedByUserId: userId,
      updatedAt: now,
    };
    if (existingConsent) {
      await ctx.db.patch(existingConsent._id, consentPatch);
    } else {
      await ctx.db.insert("consents", { ...consentPatch, createdAt: now });
    }
  }
}

async function syncPersonEnrollment(ctx: any, teenId: any, payload: any, existingPersonId?: any) {
  const now = new Date().toISOString();
  const personPatch = {
    firstName: payload.nombre,
    lastName: payload.apellido,
    birthDate: payload.nacimiento || undefined,
    gender: payload.sexo,
    primaryPhone: payload.telefono || payload.telefonoPadre || undefined,
    secondaryPhone: payload.telefonoSecundario,
    photoStorageId: payload.fotoStorageId,
    status: isArchivedTeen(payload) ? "archived" as const : "active" as const,
    updatedAt: now,
  };
  let personId = existingPersonId;
  if (personId) {
    await ctx.db.patch(personId, personPatch);
  } else {
    personId = await ctx.db.insert("people", { ...personPatch, createdAt: now });
    await ctx.db.patch(teenId, { personId });
  }

  const existingEnrollment = await ctx.db
    .query("ministryEnrollments")
    .withIndex("by_teenId", (q: any) => q.eq("teenId", teenId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .first();
  const enrollmentPatch = {
    personId,
    teenId,
    ministryKey: "teens" as const,
    campusId: payload.campusId,
    ministryId: payload.ministryId,
    groupId: payload.groupId,
    role: "participant" as const,
    status: isArchivedTeen(payload) ? "archived" as const : "active" as const,
    startedAt: payload.fechaIngreso,
    updatedAt: now,
  };
  if (existingEnrollment) {
    await ctx.db.patch(existingEnrollment._id, enrollmentPatch);
  } else {
    await ctx.db.insert("ministryEnrollments", { ...enrollmentPatch, createdAt: now });
  }
  return personId;
}

function assertValidDate(value: string | undefined, fieldName: string, { allowFuture = false } = {}) {
  if (value === undefined || value === "") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`El campo ${fieldName} debe usar formato AAAA-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`El campo ${fieldName} no tiene una fecha válida.`);
  }
  if (!allowFuture) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) throw new Error(`El campo ${fieldName} no puede estar en el futuro.`);
  }
}

async function validateScopeConsistency(ctx: any, campusId?: string, ministryId?: string, groupId?: string) {
  if (groupId && !ministryId) throw new Error("No puedes asignar grupo sin ministerio.");
  if (ministryId && !campusId) throw new Error("No puedes asignar ministerio sin sede.");

  if (ministryId) {
    const ministry = await ctx.db.get(ministryId);
    if (!ministry) throw new Error("El ministerio seleccionado no existe.");
    if (campusId && String(ministry.campusId) !== String(campusId)) {
      throw new Error("El ministerio no pertenece a la sede seleccionada.");
    }
  }

  if (groupId) {
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("El grupo seleccionado no existe.");
    if (ministryId && String(group.ministryId) !== String(ministryId)) {
      throw new Error("El grupo no pertenece al ministerio seleccionado.");
    }
  }
}

async function buildTeenPayload(ctx: any, args: any, currentTeen?: any) {
  const isQuick = args.registroRapido === undefined ? currentTeen?.registroRapido === true : args.registroRapido === true;
  const nombre = cleanText(args.nombre ?? currentTeen?.nombre);
  const apellido = cleanText(args.apellido ?? currentTeen?.apellido) || (isQuick ? "Visitante" : undefined);
  if (!nombre || nombre.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres.");
  if (!apellido || apellido.length < 2) throw new Error("El apellido debe tener al menos 2 caracteres.");

  const nacimiento = cleanText(args.nacimiento ?? currentTeen?.nacimiento) ?? "";
  const fechaIngreso = cleanText(args.fechaIngreso ?? currentTeen?.fechaIngreso);
  const fechaConsentimiento = cleanText(args.fechaConsentimiento ?? currentTeen?.fechaConsentimiento);
  assertValidDate(nacimiento, "fecha de nacimiento");
  assertValidDate(fechaIngreso, "fecha de ingreso");
  assertValidDate(fechaConsentimiento, "fecha de consentimiento");

  const campusId = args.campusId === undefined ? currentTeen?.campusId : cleanOptionalId(args.campusId);
  const ministryId = args.ministryId === undefined ? currentTeen?.ministryId : cleanOptionalId(args.ministryId);
  const groupId = args.groupId === undefined ? currentTeen?.groupId : cleanOptionalId(args.groupId);
  await validateScopeConsistency(ctx, campusId, ministryId, groupId);

  const telefono = normalizePhone(args.telefono ?? currentTeen?.telefono) ?? "";
  const telefonoPadre = normalizePhone(args.telefonoPadre ?? currentTeen?.telefonoPadre) ?? "";
  const contactoEmergenciaTelefono = normalizePhone(args.contactoEmergenciaTelefono ?? currentTeen?.contactoEmergenciaTelefono);
  if (!isQuick && !campusId) throw new Error("Un adolescente regular debe tener sede asignada.");
  if (!isQuick && !(telefono || telefonoPadre || contactoEmergenciaTelefono)) {
    throw new Error("Un adolescente regular debe tener teléfono o contacto familiar.");
  }

  const payload = {
    nombre,
    apellido,
    nacimiento,
    sexo: args.sexo === undefined ? currentTeen?.sexo : args.sexo,
    telefono,
    telefonoPadre,
    telefonoSecundario: normalizePhone(args.telefonoSecundario ?? currentTeen?.telefonoSecundario),
    nombreEncargado: cleanText(args.nombreEncargado ?? currentTeen?.nombreEncargado),
    parentescoEncargado: cleanText(args.parentescoEncargado ?? currentTeen?.parentescoEncargado),
    contactoEmergenciaNombre: cleanText(args.contactoEmergenciaNombre ?? currentTeen?.contactoEmergenciaNombre),
    contactoEmergenciaTelefono,
    permiteMensajes: args.permiteMensajes === undefined ? currentTeen?.permiteMensajes : args.permiteMensajes,
    gustos: cleanText(args.gustos ?? currentTeen?.gustos) ?? "",
    notas: cleanText(args.notas ?? currentTeen?.notas) ?? "",
    observacionInicial: cleanText(args.observacionInicial ?? currentTeen?.observacionInicial),
    foto: cleanText(args.foto ?? currentTeen?.foto) ?? "",
    fotoStorageId: args.fotoStorageId === undefined ? currentTeen?.fotoStorageId : args.fotoStorageId,
    fechaIngreso,
    estado: args.estado === undefined ? currentTeen?.estado ?? "activo" : args.estado,
    fuenteIngreso: args.fuenteIngreso === undefined ? currentTeen?.fuenteIngreso : args.fuenteIngreso,
    primeraVisita: cleanText(args.primeraVisita ?? currentTeen?.primeraVisita),
    liderPrincipalId: args.liderPrincipalId === undefined ? currentTeen?.liderPrincipalId : cleanOptionalId(args.liderPrincipalId),
    nivelIntegracion: args.nivelIntegracion === undefined ? currentTeen?.nivelIntegracion : args.nivelIntegracion,
    invitadoPor: cleanText(args.invitadoPor ?? currentTeen?.invitadoPor),
    edadAproximada: cleanText(args.edadAproximada ?? currentTeen?.edadAproximada),
    registroRapido: isQuick,
    motivoInactividad: cleanText(args.motivoInactividad ?? currentTeen?.motivoInactividad),
    colegio: cleanText(args.colegio ?? currentTeen?.colegio),
    gradoEscolar: cleanText(args.gradoEscolar ?? currentTeen?.gradoEscolar),
    barrio: cleanText(args.barrio ?? currentTeen?.barrio),
    viveCon: cleanText(args.viveCon ?? currentTeen?.viveCon),
    decisionEspiritual: args.decisionEspiritual === undefined ? currentTeen?.decisionEspiritual : args.decisionEspiritual,
    requiereSeguimientoEspecial:
      args.requiereSeguimientoEspecial === undefined
        ? currentTeen?.requiereSeguimientoEspecial
        : args.requiereSeguimientoEspecial,
    consentimientoDatos: args.consentimientoDatos === undefined ? currentTeen?.consentimientoDatos : args.consentimientoDatos,
    consentimientoFoto: args.consentimientoFoto === undefined ? currentTeen?.consentimientoFoto : args.consentimientoFoto,
    fechaConsentimiento,
    completedBy: args.completedBy === undefined ? currentTeen?.completedBy : args.completedBy,
    campusId,
    ministryId,
    groupId,
  };
  return {
    ...payload,
    fichaCompleta: args.fichaCompleta === false ? false : isCompleteProfile(payload),
  };
}

async function findDuplicateMatches(ctx: any, args: any, excludeId?: string) {
  const all = await ctx.db.query("teens").collect();
  const fullName = `${cleanText(args.nombre) || ""} ${cleanText(args.apellido) || ""}`.trim().toLowerCase();
  const teenPhoneDigits = (args.telefono || "").replace(/\D/g, "");
  const parentPhoneDigits = (args.telefonoPadre || "").replace(/\D/g, "");
  return all
    .filter((teen: any) => !isArchivedTeen(teen) && (!excludeId || String(teen._id) !== excludeId))
    .map((teen: any) => {
      const teenFullName = `${teen.nombre} ${teen.apellido}`.trim().toLowerCase();
      const teenDigits = (teen.telefono || "").replace(/\D/g, "");
      const parentDigits = (teen.telefonoPadre || "").replace(/\D/g, "");
      const reasons: string[] = [];
      if (fullName && teenFullName === fullName) reasons.push("Mismo nombre completo");
      if (teenPhoneDigits && teenDigits && teenPhoneDigits === teenDigits) reasons.push("Mismo teléfono del adolescente");
      if (parentPhoneDigits && parentDigits && parentPhoneDigits === parentDigits) reasons.push("Mismo teléfono del tutor");
      return reasons.length > 0 ? { teenId: teen._id, nombre: teen.nombre, apellido: teen.apellido, reasons } : null;
    })
    .filter(Boolean);
}

export const list = query({
  args: { token: v.optional(v.string()), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("teens").collect();
    let filtered = args.includeArchived ? all : all.filter((teen: any) => !isArchivedTeen(teen));
    if (args.token) {
      const access = await getEffectiveAccess(ctx, args.token);
      if (access && !access.isGlobal) {
        filtered = filterTeensByScope(access, filtered);
      }
    }
    const resolved = [];
    for (const t of filtered) {
      resolved.push({
        ...t,
        foto: t.fotoStorageId ? (await ctx.storage.getUrl(t.fotoStorageId)) || "" : t.foto,
      });
    }
    return resolved;
  },
});

export const get = query({
  args: { id: v.id("teens") },
  handler: async (ctx, args) => {
    const teen = await ctx.db.get(args.id);
    if (!teen) return null;
    return {
      ...teen,
      foto: teen.fotoStorageId ? (await ctx.storage.getUrl(teen.fotoStorageId)) || "" : teen.foto,
    };
  },
});

export const create = mutation({
  args: {
    nombre: v.string(),
    apellido: v.string(),
    nacimiento: v.string(),
    sexo: v.optional(teenGender),
    telefono: v.string(),
    telefonoPadre: v.string(),
    telefonoSecundario: v.optional(v.string()),
    nombreEncargado: v.optional(v.string()),
    parentescoEncargado: v.optional(v.string()),
    contactoEmergenciaNombre: v.optional(v.string()),
    contactoEmergenciaTelefono: v.optional(v.string()),
    permiteMensajes: v.optional(v.boolean()),
    gustos: v.string(),
    notas: v.string(),
    observacionInicial: v.optional(v.string()),
    foto: v.string(),
    fotoStorageId: v.optional(v.id("_storage")),
    fechaIngreso: v.optional(v.string()),
    estado: v.optional(teenStatus),
    fuenteIngreso: v.optional(sourceType),
    primeraVisita: v.optional(v.string()),
    liderPrincipalId: v.optional(v.union(v.id("users"), v.literal(""))),
    nivelIntegracion: v.optional(integrationLevel),
    invitadoPor: v.optional(v.string()),
    edadAproximada: v.optional(v.string()),
    registroRapido: v.optional(v.boolean()),
    fichaCompleta: v.optional(v.boolean()),
    motivoInactividad: v.optional(v.string()),
    colegio: v.optional(v.string()),
    gradoEscolar: v.optional(v.string()),
    barrio: v.optional(v.string()),
    viveCon: v.optional(v.string()),
    decisionEspiritual: v.optional(spiritualStage),
    requiereSeguimientoEspecial: v.optional(v.boolean()),
    consentimientoDatos: v.optional(v.boolean()),
    consentimientoFoto: v.optional(v.boolean()),
    fechaConsentimiento: v.optional(v.string()),
    campusId: optionalCampusId,
    ministryId: optionalMinistryId,
    groupId: optionalGroupId,
    token: v.optional(v.string()),
    confirmDuplicate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const payload = await buildTeenPayload(ctx, args);
    const duplicates = await findDuplicateMatches(ctx, payload);
    if (duplicates.length > 0 && !args.confirmDuplicate) {
      throw new Error("Posible duplicado detectado. Confirma explícitamente para guardar de todos modos.");
    }
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, payload)) {
      throw new Error("No tienes permisos para crear adolescentes en este ámbito (Sede/Ministerio/Grupo).");
    }
    const id = await ctx.db.insert("teens", payload);
    await syncPersonEnrollment(ctx, id, payload);
    await syncFamilyRecords(ctx, id, payload, access.user._id);
    await logAudit(ctx, {
      token: args.token,
      action: "teen.created",
      entityType: "teen",
      entityId: String(id),
      newValue: payload,
      details: `${payload.nombre} ${payload.apellido}`,
    });
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("teens"),
    nombre: v.optional(v.string()),
    apellido: v.optional(v.string()),
    nacimiento: v.optional(v.string()),
    sexo: v.optional(teenGender),
    telefono: v.optional(v.string()),
    telefonoPadre: v.optional(v.string()),
    telefonoSecundario: v.optional(v.string()),
    nombreEncargado: v.optional(v.string()),
    parentescoEncargado: v.optional(v.string()),
    contactoEmergenciaNombre: v.optional(v.string()),
    contactoEmergenciaTelefono: v.optional(v.string()),
    permiteMensajes: v.optional(v.boolean()),
    gustos: v.optional(v.string()),
    notas: v.optional(v.string()),
    observacionInicial: v.optional(v.string()),
    foto: v.optional(v.string()),
    fotoStorageId: v.optional(v.id("_storage")),
    fechaIngreso: v.optional(v.string()),
    estado: v.optional(teenStatus),
    fuenteIngreso: v.optional(sourceType),
    primeraVisita: v.optional(v.string()),
    liderPrincipalId: v.optional(v.union(v.id("users"), v.literal(""))),
    nivelIntegracion: v.optional(integrationLevel),
    invitadoPor: v.optional(v.string()),
    edadAproximada: v.optional(v.string()),
    registroRapido: v.optional(v.boolean()),
    fichaCompleta: v.optional(v.boolean()),
    motivoInactividad: v.optional(v.string()),
    colegio: v.optional(v.string()),
    gradoEscolar: v.optional(v.string()),
    barrio: v.optional(v.string()),
    viveCon: v.optional(v.string()),
    decisionEspiritual: v.optional(spiritualStage),
    requiereSeguimientoEspecial: v.optional(v.boolean()),
    consentimientoDatos: v.optional(v.boolean()),
    consentimientoFoto: v.optional(v.boolean()),
    fechaConsentimiento: v.optional(v.string()),
    campusId: optionalCampusId,
    ministryId: optionalMinistryId,
    groupId: optionalGroupId,
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Ficha no encontrada");
    
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, current)) {
      throw new Error("No tienes permisos para editar a este adolescente.");
    }

    const payload = await buildTeenPayload(ctx, args, current);
    
    if (!canAccessTeen(access, payload)) {
      throw new Error("No tienes permisos para mover al adolescente a este ámbito.");
    }
    
    await ctx.db.patch(args.id, payload);
    await syncPersonEnrollment(ctx, args.id, payload, current.personId);
    await syncFamilyRecords(ctx, args.id, payload, access.user._id);
    const leaderChanged = String(current.liderPrincipalId || "") !== String(payload.liderPrincipalId || "");
    const inheritedLeaderChanged = !payload.liderPrincipalId && String(current.groupId || "") !== String(payload.groupId || "");
    if (leaderChanged || inheritedLeaderChanged) {
      const resolvedLeader = await resolveEffectiveLeader(ctx, payload);
      await reassignOpenTasksForTeen(ctx, {
        teenId: args.id,
        assignedToUserId: resolvedLeader.userId,
        token: args.token,
        reason: "Reasignación automática por cambio de líder responsable del adolescente.",
      });
      await logAudit(ctx, {
        token: args.token,
        action: "teen.leader_changed",
        entityType: "teen",
        entityId: String(args.id),
        previousValue: { liderPrincipalId: current.liderPrincipalId },
        newValue: { liderPrincipalId: payload.liderPrincipalId, leaderSource: resolvedLeader.source },
        details: inheritedLeaderChanged ? `${payload.nombre} ${payload.apellido} · cambio de grupo` : `${payload.nombre} ${payload.apellido}`,
      });
    }
    if (String(current.groupId || "") !== String(payload.groupId || "")) {
      await ctx.db.insert("teenGroupHistory", {
        teenId: args.id,
        previousGroupId: current.groupId,
        newGroupId: payload.groupId,
        changedByUserId: access.user._id,
        reason: "Cambio desde ficha pastoral",
        createdAt: new Date().toISOString(),
      });
      await logAudit(ctx, {
        token: args.token,
        action: "teen.group_changed",
        entityType: "teen",
        entityId: String(args.id),
        previousValue: { groupId: current.groupId },
        newValue: { groupId: payload.groupId },
        details: `${payload.nombre} ${payload.apellido}`,
      });
    }
    const deactivated = current.estado !== payload.estado && ["inactivo", "egresado"].includes(payload.estado || "");
    await logAudit(ctx, {
      token: args.token,
      action: deactivated ? "teen.deactivated" : "teen.updated",
      entityType: "teen",
      entityId: String(args.id),
      previousValue: current,
      newValue: payload,
      details: `${payload.nombre} ${payload.apellido}`,
    });
  },
});

export const bulkAssignLeader = mutation({
  args: {
    token: v.string(),
    teenIds: v.array(v.id("teens")),
    liderPrincipalId: v.optional(v.id("users")),
    useGroupLeader: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "coordinador");
    const now = new Date().toISOString();
    for (const teenId of args.teenIds) {
      const teen = await ctx.db.get(teenId);
      if (!teen || !canAccessTeen(access, teen)) continue;
      const liderPrincipalId = args.useGroupLeader ? undefined : args.liderPrincipalId;
      const updatedTeen = { ...teen, liderPrincipalId };
      const resolvedLeader = await resolveEffectiveLeader(ctx, updatedTeen);
      await ctx.db.patch(teenId, { liderPrincipalId });
      await reassignOpenTasksForTeen(ctx, {
        teenId,
        assignedToUserId: resolvedLeader.userId,
        token: args.token,
        reason: "Reasignación automática por actualización masiva de líder responsable.",
      });
      await logAudit(ctx, {
        token: args.token,
        action: "teen.leader_changed",
        entityType: "teen",
        entityId: String(teenId),
        previousValue: { liderPrincipalId: teen.liderPrincipalId },
        newValue: { liderPrincipalId, leaderSource: resolvedLeader.source },
        details: "Líder responsable actualizado de forma masiva.",
      });
    }
    return { updated: args.teenIds.length, updatedAt: now };
  },
});

export const listLeaderAssignments = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const groups = new Map((await ctx.db.query("group").collect()).map((group) => [String(group._id), group]));
    const users = new Map((await ctx.db.query("users").collect()).map((user) => [String(user._id), user.name]));
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect());
    return teens.map((teen) => {
      const userId = teen.liderPrincipalId || groups.get(String(teen.groupId || ""))?.leaderId;
      const source = teen.liderPrincipalId ? "individual" : userId ? "group" : "unassigned";
      return { teenId: teen._id, userId, userName: userId ? users.get(String(userId)) || "Líder" : "Sin responsable", source };
    });
  },
});

export const detectDuplicates = query({
  args: {
    nombre: v.string(),
    apellido: v.string(),
    telefono: v.optional(v.string()),
    telefonoPadre: v.optional(v.string()),
    excludeId: v.optional(v.id("teens")),
  },
  handler: async (ctx, args) => {
    return await findDuplicateMatches(ctx, args, args.excludeId ? String(args.excludeId) : undefined);
  },
});

export const createPublicRegistrationLink = mutation({
  args: {
    token: v.string(),
    scopeMode: v.optional(publicRegistrationScopeMode),
    campusId: optionalCampusId,
    ministryId: optionalMinistryId,
    groupId: optionalGroupId,
  },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "helper");
    const scopeMode = args.scopeMode || "fixed";
    const scope = {
      campusId: cleanOptionalId(args.campusId),
      ministryId: cleanOptionalId(args.ministryId),
      groupId: cleanOptionalId(args.groupId),
    };
    if (scopeMode === "general" && !access.isGlobal) {
      throw new Error("Solo administradores, pastores o directores pueden crear un enlace general.");
    }
    if (scopeMode === "fixed" && (!scope.campusId || !scope.ministryId)) {
      throw new Error("Selecciona una sede y un ministerio para crear un QR dirigido.");
    }
    await validateScopeConsistency(ctx, scope.campusId, scope.ministryId, scope.groupId);
    if (scopeMode === "fixed" && (scope.campusId || scope.ministryId || scope.groupId) && !canAccessTeen(access, scope)) {
      throw new Error("No tienes permisos para crear enlaces de registro en este ámbito.");
    }

    const now = new Date().toISOString();
    const publicToken = newPublicToken();
    const shortCode = await createUniquePublicShortCode(ctx);
    const id = await ctx.db.insert("publicRegistrationLinks", {
      campusId: scope.campusId as any,
      ministryId: scope.ministryId as any,
      groupId: scope.groupId as any,
      token: publicToken,
      shortCode,
      scopeMode,
      createdByUserId: access.user._id,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      token: args.token,
      action: "public_registration_link.created",
      entityType: "publicRegistrationLink",
      entityId: String(id),
      newValue: { ...scope, scopeMode, shortCode },
      details: "Enlace público de registro creado.",
    });
    return { id, token: publicToken, shortCode, scopeMode };
  },
});

export const getPublicRegistrationLink = query({
  args: { publicToken: v.optional(v.string()), shortCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const link = await resolvePublicRegistrationLink(ctx, args.publicToken, args.shortCode);
    if (!link || !link.enabled) return null;
    const campus = link.campusId ? await ctx.db.get(link.campusId) : null;
    const ministry = link.ministryId ? await ctx.db.get(link.ministryId) : null;
    const group = link.groupId ? await ctx.db.get(link.groupId) : null;
    return {
      token: link.token,
      shortCode: link.shortCode,
      scopeMode: link.scopeMode || "fixed",
      campusName: (campus as any)?.name,
      ministryName: (ministry as any)?.name,
      groupName: (group as any)?.name,
    };
  },
});

export const listPublicRegistrationCampuses = query({
  args: { publicToken: v.optional(v.string()), shortCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const link = await resolvePublicRegistrationLink(ctx, args.publicToken, args.shortCode);
    if (!link || !link.enabled || (link.scopeMode || "fixed") !== "general") return [];
    return (await ctx.db.query("campus").collect()).map((campus: any) => ({ _id: campus._id, name: campus.name }));
  },
});

export const listPublicRegistrationMinistries = query({
  args: { publicToken: v.optional(v.string()), shortCode: v.optional(v.string()), campusId: v.id("campus") },
  handler: async (ctx, args) => {
    const link = await resolvePublicRegistrationLink(ctx, args.publicToken, args.shortCode);
    if (!link || !link.enabled || (link.scopeMode || "fixed") !== "general") return [];
    return (await ctx.db.query("ministry").withIndex("by_campusId", (q: any) => q.eq("campusId", args.campusId)).collect())
      .map((ministry: any) => ({ _id: ministry._id, name: ministry.name }));
  },
});

export const listPublicRegistrationGroups = query({
  args: { publicToken: v.optional(v.string()), shortCode: v.optional(v.string()), ministryId: v.id("ministry") },
  handler: async (ctx, args) => {
    const link = await resolvePublicRegistrationLink(ctx, args.publicToken, args.shortCode);
    if (!link || !link.enabled || (link.scopeMode || "fixed") !== "general") return [];
    return (await ctx.db.query("group").withIndex("by_ministryId", (q: any) => q.eq("ministryId", args.ministryId)).collect())
      .map((group: any) => ({ _id: group._id, name: group.name }));
  },
});

export const submitPublicRegistration = mutation({
  args: {
    publicToken: v.optional(v.string()),
    shortCode: v.optional(v.string()),
    campusId: optionalCampusId,
    ministryId: optionalMinistryId,
    groupId: optionalGroupId,
    completedBy: v.optional(publicRegistrationCompletedBy),
    nombre: v.string(),
    apellido: v.string(),
    nacimiento: v.optional(v.string()),
    edadAproximada: v.optional(v.string()),
    telefono: v.optional(v.string()),
    telefonoPadre: v.string(),
    nombreEncargado: v.optional(v.string()),
    parentescoEncargado: v.optional(v.string()),
    invitadoPor: v.optional(v.string()),
    fuenteIngreso: v.optional(sourceType),
    observacionInicial: v.optional(v.string()),
    consentimientoDatos: v.optional(v.boolean()),
    consentimientoFoto: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const link = await resolvePublicRegistrationLink(ctx, args.publicToken, args.shortCode);
    if (!link || !link.enabled) throw new Error("El enlace de registro no está disponible.");

    const scopeMode = link.scopeMode || "fixed";
    const completedBy = args.completedBy || "teen";
    if (!args.fuenteIngreso) throw new Error("Selecciona cómo conoció el ministerio.");
    if (args.edadAproximada !== undefined && args.edadAproximada !== "") {
      const age = Number(args.edadAproximada);
      if (!/^\d+$/.test(args.edadAproximada) || !Number.isInteger(age) || age < 1 || age > 99) {
        throw new Error("La edad aproximada debe ser un número entre 1 y 99.");
      }
    }
    if (completedBy === "guardian") {
      if (!args.nombreEncargado?.trim()) throw new Error("Ingresa el nombre del apoderado.");
      if (!args.parentescoEncargado?.trim()) throw new Error("Indica el parentesco del apoderado.");
      if (!args.consentimientoDatos) throw new Error("El apoderado debe autorizar el tratamiento de datos.");
    }
    const selectedScope = {
      campusId: cleanOptionalId(args.campusId),
      ministryId: cleanOptionalId(args.ministryId),
      groupId: cleanOptionalId(args.groupId),
    };
    const scope = scopeMode === "general"
      ? selectedScope
      : { campusId: link.campusId, ministryId: link.ministryId, groupId: link.groupId };
    if (!scope.campusId || !scope.ministryId) throw new Error("Selecciona una sede y un ministerio para continuar.");
    await validateScopeConsistency(ctx, scope.campusId, scope.ministryId, scope.groupId);
    const canRecordConsent = completedBy === "guardian";

    const today = new Date().toISOString().slice(0, 10);
    const payload = await buildTeenPayload(ctx, {
      nombre: args.nombre,
      apellido: args.apellido,
      nacimiento: args.nacimiento || "",
      telefono: args.telefono || "",
      telefonoPadre: args.telefonoPadre,
      nombreEncargado: args.nombreEncargado,
      parentescoEncargado: args.parentescoEncargado,
      invitadoPor: args.fuenteIngreso === "amigo" || args.fuenteIngreso === "familiar" ? args.invitadoPor : undefined,
      fuenteIngreso: args.fuenteIngreso,
      observacionInicial: args.observacionInicial,
      consentimientoDatos: canRecordConsent ? args.consentimientoDatos : false,
      consentimientoFoto: canRecordConsent ? args.consentimientoFoto : false,
      fechaConsentimiento: canRecordConsent && (args.consentimientoDatos || args.consentimientoFoto) ? today : "",
      campusId: scope.campusId,
      ministryId: scope.ministryId,
      groupId: scope.groupId,
      completedBy,
      estado: "visitante",
      nivelIntegracion: "nuevo",
      registroRapido: true,
      fichaCompleta: false,
      primeraVisita: today,
      fechaIngreso: today,
      edadAproximada: args.edadAproximada,
      gustos: "",
      notas: "",
      foto: "",
    });
    const duplicates = await findDuplicateMatches(ctx, payload);
    if (duplicates.length > 0) {
      throw new Error("Ya existe una ficha similar. Por favor confirma tus datos con un líder.");
    }

    const id = await ctx.db.insert("teens", { ...payload, fichaCompleta: false });
    await syncPersonEnrollment(ctx, id, payload);
    await syncFamilyRecords(ctx, id, payload, link.createdByUserId);
    await logAudit(ctx, {
      userId: link.createdByUserId,
      userName: "Registro público",
      action: "teen.public_registered",
      entityType: "teen",
      entityId: String(id),
      newValue: { ...payload, fichaCompleta: false },
      details: `${payload.nombre} ${payload.apellido} · ${scopeMode} · completado por ${completedBy}`,
    });
    return { id };
  },
});

export const remove = mutation({
  args: { id: v.id("teens"), token: v.optional(v.string()), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Ficha no encontrada");
    
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, current)) {
      throw new Error("No tienes permisos para archivar a este adolescente.");
    }
    const patch = {
      estado: "archivado" as const,
      archivedAt: new Date().toISOString(),
      archivedBy: access.user._id,
      deleteReason: args.reason || "Archivado desde ficha pastoral",
    };
    await ctx.db.patch(args.id, patch);
    await syncPersonEnrollment(ctx, args.id, { ...current, ...patch }, current.personId);
    await logAudit(ctx, {
      token: args.token,
      action: "teen.archived",
      entityType: "teen",
      entityId: String(args.id),
      previousValue: { estado: current.estado, archivedAt: current.archivedAt },
      newValue: patch,
      changedFields: ["estado", "archivedAt", "archivedBy", "deleteReason"],
      details: `${current.nombre} ${current.apellido}`,
    });
  },
});

export const migrateNotasToJournal = mutation({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    let migrated = 0;
    for (const teen of teens) {
      if (teen.notas && teen.notas.trim()) {
        await ctx.db.insert("journal", {
          teenId: teen._id,
          entryDate: new Date().toISOString().slice(0, 10),
          content: teen.notas.trim(),
          category: "other",
          leaderName: "Migración",
          followUp: false,
        });
        await ctx.db.patch(teen._id, { notas: "" });
        migrated++;
      }
    }
    return { migrated };
  },
});

export const migrateTeenProfiles = mutation({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    let migrated = 0;
    for (const teen of teens) {
      const patch: Record<string, any> = {};
      if (teen.notas?.trim() && !(teen as any).observacionInicial) {
        patch.observacionInicial = teen.notas.trim();
      }
      if (!(teen as any).estado) patch.estado = "activo";
      if ((teen as any).permiteMensajes === undefined) patch.permiteMensajes = true;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(teen._id, patch);
        migrated++;
      }
    }
    return { migrated };
  },
});

export const migrateFamilyRecords = mutation({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    let migrated = 0;
    for (const teen of teens) {
      if (isArchivedTeen(teen)) continue;
      await syncFamilyRecords(ctx, teen._id, teen);
      migrated++;
    }
    return { migrated };
  },
});

export const migratePeopleEnrollments = mutation({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    let migrated = 0;
    for (const teen of teens) {
      await syncPersonEnrollment(ctx, teen._id, teen, teen.personId);
      migrated++;
    }
    return { migrated };
  },
});

export const removeAll = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const access = await requireAccess(ctx, args.token, "pastor");
    const now = new Date().toISOString();
    const allTeens = (await ctx.db.query("teens").collect()).filter((teen: any) => !isArchivedTeen(teen));
    for (const t of allTeens) {
      await ctx.db.patch(t._id, {
        estado: "archivado",
        archivedAt: now,
        archivedBy: access.user._id,
        deleteReason: "Archivado masivo desde ajustes",
      });
      await syncPersonEnrollment(ctx, t._id, { ...t, estado: "archivado" }, t.personId);
    }
    await logAudit(ctx, {
      token: args.token,
      action: "data.bulk_archived",
      entityType: "system",
      changedFields: ["estado", "archivedAt", "archivedBy", "deleteReason"],
      details: `Archivado masivo: ${allTeens.length} adolescentes. Asistencias y bitacoras se conservaron.`,
    });
  },
});
