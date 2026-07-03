import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.string(),
    hashedPassword: v.string(),
    salt: v.string(),
    isActive: v.boolean(),
    permissions: v.optional(v.array(v.string())),
    avatar: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    phone: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.string(),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
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
    role: v.string(),
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

  customRoles: defineTable({
    name: v.string(),
    permissions: v.array(v.string()),
    createdAt: v.string(),
  })
    .index("by_name", ["name"]),

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
    fotoStorageId: v.optional(v.id("_storage")),
    fechaIngreso: v.optional(v.string()),
    estado: v.optional(
      v.union(
        v.literal("activo"),
        v.literal("visitante"),
        v.literal("nuevo"),
        v.literal("seguimiento"),
        v.literal("inactivo"),
        v.literal("trasladado"),
        v.literal("archivado"),
        v.literal("eliminado"),
        v.literal("egresado")
      )
    ),
    fuenteIngreso: v.optional(
      v.union(
        v.literal("amigo"),
        v.literal("familiar"),
        v.literal("campaña"),
        v.literal("culto"),
        v.literal("escuela_biblica"),
        v.literal("otro")
      )
    ),
    primeraVisita: v.optional(v.string()),
    liderPrincipalId: v.optional(v.id("users")),
    nivelIntegracion: v.optional(
      v.union(
        v.literal("nuevo"),
        v.literal("en_proceso"),
        v.literal("integrado"),
        v.literal("necesita_acompañamiento")
      )
    ),
    invitadoPor: v.optional(v.string()),
    edadAproximada: v.optional(v.string()),
    registroRapido: v.optional(v.boolean()),
    fichaCompleta: v.optional(v.boolean()),
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
    archivedAt: v.optional(v.string()),
    archivedBy: v.optional(v.id("users")),
    deletedAt: v.optional(v.string()),
    deletedBy: v.optional(v.id("users")),
    deleteReason: v.optional(v.string()),
  })
    .index("by_campusId", ["campusId"])
    .index("by_ministryId", ["ministryId"])
    .index("by_groupId", ["groupId"])
    .index("by_estado", ["estado"])
    .index("by_fechaIngreso", ["fechaIngreso"]),

  teenGroupHistory: defineTable({
    teenId: v.id("teens"),
    previousGroupId: v.optional(v.id("group")),
    newGroupId: v.optional(v.id("group")),
    changedByUserId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_teenId", ["teenId"]),

  guardians: defineTable({
    teenId: v.id("teens"),
    name: v.string(),
    relationship: v.optional(v.string()),
    phone: v.optional(v.string()),
    secondaryPhone: v.optional(v.string()),
    emergencyName: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    isPrimary: v.boolean(),
    canReceiveMessages: v.optional(v.boolean()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_teenId", ["teenId"]),

  consents: defineTable({
    teenId: v.id("teens"),
    type: v.union(v.literal("data"), v.literal("photo")),
    status: v.union(v.literal("granted"), v.literal("pending"), v.literal("declined")),
    guardianName: v.optional(v.string()),
    guardianId: v.optional(v.id("guardians")),
    grantedAt: v.optional(v.string()),
    recordedByUserId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_teenId", ["teenId"])
    .index("by_teen_type", ["teenId", "type"]),

  meetingSessions: defineTable({
    date: v.string(),
    type: v.union(
      v.literal("culto_adolescentes"),
      v.literal("celula"),
      v.literal("discipulado"),
      v.literal("ensayo"),
      v.literal("evento_especial"),
      v.literal("campamento")
    ),
    campusId: v.optional(v.id("campus")),
    ministryId: v.optional(v.id("ministry")),
    groupId: v.optional(v.id("group")),
    title: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.string(),
  })
    .index("by_date", ["date"])
    .index("by_groupId", ["groupId"])
    .index("by_date_type", ["date", "type"]),

  attendance: defineTable({
    sessionId: v.optional(v.id("meetingSessions")),
    date: v.string(),
    teenId: v.id("teens"),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("excused")
    ),
    excuseReason: v.optional(v.string()),
    absenceComment: v.optional(v.string()),
    checkInMethod: v.optional(
      v.union(v.literal("manual"), v.literal("mobile"), v.literal("qr"))
    ),
  })
    .index("by_date", ["date"])
    .index("by_teenId", ["teenId"])
    .index("by_date_and_teen", ["date", "teenId"])
    .index("by_sessionId", ["sessionId"])
    .index("by_session_and_teen", ["sessionId", "teenId"]),

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
    confidence: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    humanReviewRequired: v.optional(v.boolean()),
    reasoningSummary: v.optional(v.string()),
    usedDataSources: v.optional(v.array(v.string())),
    pastoralDisclaimer: v.optional(v.string()),
    reviewedByUserId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
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
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    changedFields: v.optional(v.array(v.string())),
    sensitivityLevel: v.optional(v.union(v.literal("basic"), v.literal("contact"), v.literal("pastoral"), v.literal("sensitive"))),
    redactedPreviousValue: v.optional(v.string()),
    redactedNewValue: v.optional(v.string()),
    details: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_action", ["action"])
    .index("by_userId", ["userId"])
    .index("by_entityType", ["entityType"]),

  crisisAlerts: defineTable({
    analysisId: v.id("journalAnalysis"),
    teenId: v.id("teens"),
    summary: v.string(),
    source: v.optional(v.union(v.literal("ai"), v.literal("manual"), v.literal("journal"), v.literal("attendance"))),
    humanReviewRequired: v.optional(v.boolean()),
    aiSuggestedSeverity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    finalSeverity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    reviewedByUserId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    severity: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
    assignedToUserId: v.optional(v.id("users")),
    status: v.union(
      v.literal("unattended"),
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("attended"),
      v.literal("referred"),
      v.literal("follow_up")
    ),
    decisionNotes: v.optional(v.string()),
    createdAt: v.string(),
    lastActionAt: v.optional(v.string()),
    closedAt: v.optional(v.string()),
    attendedAt: v.optional(v.string()),
    attendedBy: v.optional(v.string()),
  })
    .index("by_teenId", ["teenId"])
    .index("by_status", ["status"]),

  crisisActions: defineTable({
    alertId: v.id("crisisAlerts"),
    actorUserId: v.optional(v.id("users")),
    actionType: v.union(
      v.literal("created"),
      v.literal("assigned"),
      v.literal("task_created"),
      v.literal("attended"),
      v.literal("referred"),
      v.literal("follow_up"),
      v.literal("note")
    ),
    notes: v.string(),
    createdAt: v.string(),
  })
    .index("by_alertId", ["alertId"]),

  pastoralPlans: defineTable({
    teenId: v.id("teens"),
    currentState: v.string(),
    mainNeed: v.string(),
    monthlyGoal: v.string(),
    recommendedAction: v.string(),
    assignedToUserId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    followUpResult: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("paused")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_teenId", ["teenId"])
    .index("by_teenId_status", ["teenId", "status"])
    .index("by_priority", ["priority"]),

  pastoralTasks: defineTable({
    teenId: v.id("teens"),
    source: v.union(v.literal("manual"), v.literal("plan"), v.literal("crisis"), v.literal("ai")),
    title: v.string(),
    description: v.optional(v.string()),
    assignedToUserId: v.optional(v.id("users")),
    dueDate: v.optional(v.string()),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("done"),
      v.literal("rescheduled"),
      v.literal("canceled"),
      v.literal("escalated")
    ),
    relatedPlanId: v.optional(v.id("pastoralPlans")),
    relatedCrisisAlertId: v.optional(v.id("crisisAlerts")),
    completedAt: v.optional(v.string()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_teenId", ["teenId"])
    .index("by_status", ["status"])
    .index("by_priority", ["priority"]),

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

  weeklySummaries: defineTable({
    totalEntries: v.number(),
    mainConcerns: v.string(),
    emotionalClimate: v.string(),
    riskDistribution: v.object({
      low: v.number(),
      medium: v.number(),
      high: v.number(),
    }),
    topTags: v.array(v.string()),
    recommendation: v.string(),
    generatedAt: v.string(),
    modelUsed: v.string(),
  })
    .index("by_generatedAt", ["generatedAt"]),

  activityRecommendations: defineTable({
    title: v.string(),
    type: v.string(),
    description: v.string(),
    bibleVerse: v.optional(v.string()),
    targetTags: v.optional(v.array(v.string())),
    urgency: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("implemented"),
      v.literal("dismissed")
    ),
    generatedAt: v.string(),
    modelUsed: v.optional(v.string()),
  })
    .index("by_status", ["status"]),
});
