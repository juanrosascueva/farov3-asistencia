import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getEffectiveAccess, filterTeensByScope, requireAccess, canAccessTeen } from "./authz";
import { logAudit } from "./auditLog";

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

function assertValidDate(value: string | undefined, fieldName: string, { allowFuture = false } = {}) {
  if (value === undefined || value === "") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`El campo ${fieldName} debe usar formato AAAA-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
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
        filtered = filterTeensByScope(access, all);
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
