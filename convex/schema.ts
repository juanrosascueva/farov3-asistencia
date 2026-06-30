import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal("pastor"),
      v.literal("director"),
      v.literal("coordinador"),
      v.literal("leader"),
      v.literal("helper")
    ),
    hashedPassword: v.string(),
    salt: v.string(),
    isActive: v.boolean(),
    permissions: v.optional(v.array(v.string())),
    avatar: v.optional(v.string()),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  campus: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    createdAt: v.string(),
  }),

  ministry: defineTable({
    campusId: v.id("campus"),
    name: v.string(),
    createdAt: v.string(),
  })
    .index("by_campusId", ["campusId"]),

  group: defineTable({
    ministryId: v.id("ministry"),
    name: v.string(),
    leaderId: v.optional(v.id("users")),
    createdAt: v.string(),
  })
    .index("by_ministryId", ["ministryId"])
    .index("by_leaderId", ["leaderId"]),

  userScopes: defineTable({
    userId: v.id("users"),
    role: v.union(
      v.literal("pastor"),
      v.literal("director"),
      v.literal("coordinador"),
      v.literal("leader"),
      v.literal("helper")
    ),
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
    assignedBy: v.optional(v.id("users")),
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_campusId", ["campusId"])
    .index("by_ministryId", ["ministryId"])
    .index("by_groupId", ["groupId"]),

  teens: defineTable({
    nombre: v.string(),
    apellido: v.string(),
    nacimiento: v.string(),
    sexo: v.optional(
      v.union(
        v.literal("masculino"),
        v.literal("femenino"),
        v.literal("otro"),
        v.literal("prefiero_no_decir")
      )
    ),
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
    fechaIngreso: v.optional(v.string()),
    estado: v.optional(
      v.union(
        v.literal("activo"),
        v.literal("seguimiento"),
        v.literal("inactivo"),
        v.literal("egresado")
      )
    ),
    motivoInactividad: v.optional(v.string()),
    colegio: v.optional(v.string()),
    gradoEscolar: v.optional(v.string()),
    barrio: v.optional(v.string()),
    viveCon: v.optional(v.string()),
    decisionEspiritual: v.optional(
      v.union(
        v.literal("nuevo"),
        v.literal("conociendo"),
        v.literal("afirmando_fe"),
        v.literal("bautizado"),
        v.literal("sirviendo")
      )
    ),
    requiereSeguimientoEspecial: v.optional(v.boolean()),
    consentimientoDatos: v.optional(v.boolean()),
    consentimientoFoto: v.optional(v.boolean()),
    fechaConsentimiento: v.optional(v.string()),
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
  })
    .index("by_campusId", ["campusId"])
    .index("by_ministryId", ["ministryId"])
    .index("by_groupId", ["groupId"])
    .index("by_estado", ["estado"])
    .index("by_fechaIngreso", ["fechaIngreso"]),

  attendance: defineTable({
    date: v.string(),
    teenId: v.id("teens"),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("excused")
    ),
  })
    .index("by_date", ["date"])
    .index("by_teenId", ["teenId"])
    .index("by_date_and_teen", ["date", "teenId"]),

  journal: defineTable({
    teenId: v.id("teens"),
    entryDate: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("call"),
      v.literal("visit"),
      v.literal("chat"),
      v.literal("counseling"),
      v.literal("prayer"),
      v.literal("other")
    ),
    leaderName: v.optional(v.string()),
    followUp: v.optional(v.boolean()),
    isConfidential: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
  })
    .index("by_teenId", ["teenId"])
    .index("by_teenId_and_date", ["teenId", "entryDate"])
    .index("by_followUp", ["followUp"]),

  contacts: defineTable({
    weekStart: v.string(),
    teenId: v.id("teens"),
    status: v.union(
      v.literal("pending"),
      v.literal("contacted"),
      v.literal("skipped")
    ),
    contactedAt: v.optional(v.string()),
    leaderName: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_weekStart", ["weekStart"])
    .index("by_teenId", ["teenId"])
    .index("by_weekStart_and_teenId", ["weekStart", "teenId"]),

  journalAnalysis: defineTable({
    entryId: v.id("journal"),
    teenId: v.id("teens"),
    vulnerabilityTags: v.array(v.string()),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    suggestedActions: v.array(v.string()),
    suggestedVerses: v.array(v.string()),
    summary: v.string(),
    isCrisis: v.optional(v.boolean()),
    analyzedAt: v.string(),
    modelUsed: v.string(),
  })
    .index("by_entryId", ["entryId"])
    .index("by_teenId", ["teenId"])
    .index("by_riskLevel", ["riskLevel"])
    .index("by_isCrisis", ["isCrisis"]),

  teenSummaries: defineTable({
    teenId: v.id("teens"),
    summary: v.string(),
    pastoralMomentum: v.string(),
    mainChallenge: v.string(),
    recommendedFocus: v.string(),
    generatedAt: v.string(),
    modelUsed: v.string(),
  })
    .index("by_teenId", ["teenId"]),

  dropoutPredictions: defineTable({
    teenId: v.id("teens"),
    probability: v.number(),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    primaryFactor: v.string(),
    recommendation: v.string(),
    generatedAt: v.string(),
    modelUsed: v.string(),
  })
    .index("by_teenId", ["teenId"])
    .index("by_riskLevel", ["riskLevel"]),

  chatSessions: defineTable({
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  chatMessages: defineTable({
    sessionId: v.id("chatSessions"),
    role: v.string(),
    content: v.string(),
    createdAt: v.string(),
  })
    .index("by_sessionId", ["sessionId"]),

  auditLog: defineTable({
    action: v.string(),
    userId: v.optional(v.id("users")),
    userName: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_action", ["action"])
    .index("by_userId", ["userId"]),

  crisisAlerts: defineTable({
    analysisId: v.id("journalAnalysis"),
    teenId: v.id("teens"),
    summary: v.string(),
    status: v.union(v.literal("unattended"), v.literal("attended")),
    createdAt: v.string(),
    attendedAt: v.optional(v.string()),
    attendedBy: v.optional(v.string()),
  })
    .index("by_teenId", ["teenId"])
    .index("by_status", ["status"]),

  teenPpp: defineTable({
    teenId: v.id("teens"),
    ppp: v.number(),
    dropoutRisk: v.number(),
    vulnerabilityLevel: v.number(),
    daysWithoutContact: v.number(),
    consecutiveAbsences: v.number(),
    daysSinceLastJournal: v.number(),
    calculatedAt: v.string(),
  })
    .index("by_teenId", ["teenId"])
    .index("by_ppp", ["ppp"]),
});
