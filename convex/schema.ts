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
      v.literal("counseling"),
      v.literal("prayer"),
      v.literal("other")
    ),
  })
    .index("by_teenId", ["teenId"])
    .index("by_teenId_and_date", ["teenId", "entryDate"]),
});
