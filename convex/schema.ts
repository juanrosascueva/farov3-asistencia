import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teens: defineTable({
    nombre: v.string(),
    apellido: v.string(),
    nacimiento: v.string(),
    telefono: v.string(),
    telefonoPadre: v.string(),
    gustos: v.string(),
    notas: v.string(),
    foto: v.string(),
  }),

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
