import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const FREE_MODELS = [
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-4k-instruct:free",
];

const SYSTEM_PROMPT = `Eres un asistente de análisis pastoral. Analiza bitácoras de acompañamiento juvenil.
Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "vulnerabilityTags": ["array", "de", "tags"],
  "riskLevel": "low|medium|high",
  "suggestedActions": ["acción pastoral concreta 1", "acción pastoral concreta 2"],
  "suggestedVerses": ["Libro Capítulo:Versículo", "Libro Capítulo:Versículo"],
  "summary": "resumen de 1-2 oraciones en español"
}

Tags disponibles: salud_mental, familiar, adiccion, duelo, espiritual, academico, violencia, relaciones, fisico, economico
Si no hay suficiente contenido, usa riskLevel "low" y array vacío para tags.`;

function buildPrompt(content: string, category: string): string {
  return `Categoría: ${category}
Contenido de la bitácora:
${content}

Analiza esta entrada pastoral y devuelve el JSON requerido.`;
}

async function callModel(apiKey: string, model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://farov3-asistencia.vercel.app",
        "X-Title": "Cristo Vive - Asistente Pastoral",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

function parseAnalysis(raw: string): {
  vulnerabilityTags: string[];
  riskLevel: "low" | "medium" | "high";
  suggestedActions: string[];
  suggestedVerses: string[];
  summary: string;
} | null {
  try {
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    const riskLevel = parsed.riskLevel;
    if (!["low", "medium", "high"].includes(riskLevel)) return null;
    return {
      vulnerabilityTags: Array.isArray(parsed.vulnerabilityTags) ? parsed.vulnerabilityTags : [],
      riskLevel,
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
      suggestedVerses: Array.isArray(parsed.suggestedVerses) ? parsed.suggestedVerses : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch {
    return null;
  }
}

export const storeAnalysis = internalMutation({
  args: {
    entryId: v.id("journal"),
    teenId: v.id("teens"),
    vulnerabilityTags: v.array(v.string()),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    suggestedActions: v.array(v.string()),
    suggestedVerses: v.array(v.string()),
    summary: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("journalAnalysis", {
      ...args,
      analyzedAt: new Date().toISOString(),
    });
  },
});

export const analyzeJournalEntry = action({
  args: {
    entryId: v.id("journal"),
    teenId: v.id("teens"),
    content: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const prompt = buildPrompt(args.content, args.category);
    let result: ReturnType<typeof parseAnalysis> = null;
    let modelUsed = "";

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (!raw) continue;
      result = parseAnalysis(raw);
      if (result) {
        modelUsed = model;
        break;
      }
    }

    if (!result) {
      return { success: false, error: "All models failed" };
    }

    await ctx.runMutation(internal.ai.storeAnalysis, {
      entryId: args.entryId,
      teenId: args.teenId,
      ...result,
      modelUsed,
    });

    return { success: true, ...result, modelUsed };
  },
});

export const getAnalysisByEntry = query({
  args: { entryId: v.id("journal") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalAnalysis")
      .withIndex("by_entryId", (q) => q.eq("entryId", args.entryId))
      .first();
  },
});

export const getAnalysisByTeen = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("journalAnalysis")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
  },
});

export const getAllAnalyses = query({
  handler: async (ctx) => {
    return await ctx.db.query("journalAnalysis").order("desc").collect();
  },
});

export const generateWeeklySummary = action({
  args: {
    entries: v.array(v.object({
      content: v.string(),
      category: v.string(),
      entryDate: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const weeklyPrompt = `Eres un asesor pastoral. Genera un resumen ejecutivo semanal de estas bitácoras de acompañamiento juvenil.
Responde ÚNICAMENTE con JSON válido:
{
  "totalEntries": number,
  "mainConcerns": "párrafo corto con las principales preocupaciones",
  "emotionalClimate": "descripción del clima emocional general",
  "riskDistribution": { "low": number, "medium": number, "high": number },
  "topTags": ["tag1", "tag2"],
  "recommendation": "recomendación pastoral concreta para el equipo de líderes"
}

NO uses nombres propios en el resumen.

Bitácoras de la semana:
${args.entries.map((e, i) => `[${i + 1}] (${e.entryDate}, ${e.category}): ${e.content}`).join("\n")}`;

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, weeklyPrompt);
      if (!raw) continue;
      try {
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return { success: true, summary: parsed, modelUsed: model };
      } catch {
        continue;
      }
    }
    return { success: false, error: "All models failed for weekly summary" };
  },
});
