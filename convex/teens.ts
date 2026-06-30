import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getEffectiveAccess, filterTeensByScope, requireAccess, canAccessTeen } from "./authz";

const teenStatus = v.union(
  v.literal("activo"),
  v.literal("seguimiento"),
  v.literal("inactivo"),
  v.literal("egresado")
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
  const nombre = cleanText(args.nombre ?? currentTeen?.nombre);
  const apellido = cleanText(args.apellido ?? currentTeen?.apellido);
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

  return {
    nombre,
    apellido,
    nacimiento,
    sexo: args.sexo === undefined ? currentTeen?.sexo : args.sexo,
    telefono: normalizePhone(args.telefono ?? currentTeen?.telefono) ?? "",
    telefonoPadre: normalizePhone(args.telefonoPadre ?? currentTeen?.telefonoPadre) ?? "",
    telefonoSecundario: normalizePhone(args.telefonoSecundario ?? currentTeen?.telefonoSecundario),
    nombreEncargado: cleanText(args.nombreEncargado ?? currentTeen?.nombreEncargado),
    parentescoEncargado: cleanText(args.parentescoEncargado ?? currentTeen?.parentescoEncargado),
    contactoEmergenciaNombre: cleanText(args.contactoEmergenciaNombre ?? currentTeen?.contactoEmergenciaNombre),
    contactoEmergenciaTelefono: normalizePhone(args.contactoEmergenciaTelefono ?? currentTeen?.contactoEmergenciaTelefono),
    permiteMensajes: args.permiteMensajes === undefined ? currentTeen?.permiteMensajes : args.permiteMensajes,
    gustos: cleanText(args.gustos ?? currentTeen?.gustos) ?? "",
    notas: cleanText(args.notas ?? currentTeen?.notas) ?? "",
    observacionInicial: cleanText(args.observacionInicial ?? currentTeen?.observacionInicial),
    foto: cleanText(args.foto ?? currentTeen?.foto) ?? "",
    fotoStorageId: args.fotoStorageId === undefined ? currentTeen?.fotoStorageId : args.fotoStorageId,
    fechaIngreso,
    estado: args.estado === undefined ? currentTeen?.estado ?? "activo" : args.estado,
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
}

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("teens").collect();
    let filtered = all;
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
    const payload = await buildTeenPayload(ctx, args);
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, payload)) {
      throw new Error("No tienes permisos para crear adolescentes en este ámbito (Sede/Ministerio/Grupo).");
    }
    return await ctx.db.insert("teens", payload);
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
    const all = await ctx.db.query("teens").collect();
    const fullName = `${cleanText(args.nombre) || ""} ${cleanText(args.apellido) || ""}`.trim().toLowerCase();
    const teenPhoneDigits = (args.telefono || "").replace(/\D/g, "");
    const parentPhoneDigits = (args.telefonoPadre || "").replace(/\D/g, "");

    return all
      .filter((teen) => !args.excludeId || String(teen._id) !== String(args.excludeId))
      .map((teen) => {
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
  },
});

export const remove = mutation({
  args: { id: v.id("teens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    if (!current) throw new Error("Ficha no encontrada");
    
    const access = await requireAccess(ctx, args.token, "helper");
    if (!canAccessTeen(access, current)) {
      throw new Error("No tienes permisos para eliminar a este adolescente.");
    }
    
    for (const table of ["attendance", "journal"] as const) {
      const records = await ctx.db
        .query(table)
        .withIndex("by_teenId", (q) => q.eq("teenId", args.id))
        .collect();
      for (const r of records) {
        await ctx.db.delete(r._id);
      }
    }
    await ctx.db.delete(args.id);
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
  handler: async (ctx) => {
    const allJournal = await ctx.db.query("journal").collect();
    for (const r of allJournal) {
      await ctx.db.delete(r._id);
    }
    const allAttendance = await ctx.db.query("attendance").collect();
    for (const r of allAttendance) {
      await ctx.db.delete(r._id);
    }
    const allTeens = await ctx.db.query("teens").collect();
    for (const t of allTeens) {
      await ctx.db.delete(t._id);
    }
  },
});
