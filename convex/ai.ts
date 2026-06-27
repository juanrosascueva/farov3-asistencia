import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
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
  "isCrisis": false,
  "suggestedActions": ["acción pastoral concreta 1", "acción pastoral concreta 2"],
  "suggestedVerses": ["Libro Capítulo:Versículo", "Libro Capítulo:Versículo"],
  "summary": "resumen de 1-2 oraciones en español"
}

Tags disponibles: salud_mental, familiar, adiccion, duelo, espiritual, academico, violencia, relaciones, fisico, economico
Si no hay suficiente contenido, usa riskLevel "low" y array vacío para tags.

CRITERIOS DE CRISIS: isCrisis=true SOLO si el contenido indica PELIGRO INMEDIATO: ideación suicida, autolesión, violencia activa, abuso en curso, amenaza grave. Si no hay indicios claros, isCrisis=false.`;

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
  isCrisis: boolean;
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
      isCrisis: parsed.isCrisis === true,
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
    isCrisis: v.optional(v.boolean()),
    suggestedActions: v.array(v.string()),
    suggestedVerses: v.array(v.string()),
    summary: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("journalAnalysis", {
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

    const analysisId = await ctx.runMutation(internal.ai.storeAnalysis, {
      entryId: args.entryId,
      teenId: args.teenId,
      ...result,
      modelUsed,
    });

    if (result.isCrisis) {
      await ctx.runMutation(internal.crisis.createAlert, {
        analysisId,
        teenId: args.teenId,
        summary: result.summary,
      });
    }

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

export const getCrisisAnalyses = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("journalAnalysis")
      .withIndex("by_isCrisis", (q) => q.eq("isCrisis", true))
      .order("desc")
      .collect();
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

export const getTeenData = internalQuery({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    const teen = await ctx.db
      .query("teens")
      .filter((q) => q.eq(q.field("_id"), args.teenId))
      .first();
    const analyses = await ctx.db
      .query("journalAnalysis")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .collect();
    const journal = await ctx.db
      .query("journal")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .order("desc")
      .collect();

    const total = attendance.length;
    const present = attendance.filter((a) => a.status === "present").length;
    const pct = total ? Math.round((present / total) * 100) : 0;
    const sorted = [...attendance].sort((a, b) => b.date.localeCompare(a.date));
    let consecAbsences = 0;
    for (const r of sorted) {
      if (r.status === "absent") consecAbsences++;
      else break;
    }
    const highRiskCount = analyses.filter((a) => a.riskLevel === "high").length;
    const tags = analyses.flatMap((a) => a.vulnerabilityTags);
    const topTags = [...new Set(tags)].slice(0, 5);
    const lastJournalDate = journal.length > 0 ? journal[0].entryDate : null;
    const lastContactDate = contacts.length > 0 ? contacts[0]?.contactedAt || null : null;

    return {
      nombre: teen?.nombre || "",
      apellido: teen?.apellido || "",
      gustos: teen?.gustos || "",
      totalAttendance: total,
      presentAttendance: present,
      pct,
      consecAbsences,
      highRiskCount,
      topTags,
      analysesCount: analyses.length,
      journalCount: journal.length,
      contactCount: contacts.length,
      lastJournalDate,
      lastContactDate,
      crisisCount: analyses.filter((a) => a.isCrisis).length,
    };
  },
});

interface TeenData {
  nombre: string; apellido: string; gustos: string;
  totalAttendance: number; presentAttendance: number; pct: number;
  consecAbsences: number; highRiskCount: number; topTags: string[];
  analysesCount: number; journalCount: number; contactCount: number;
  lastJournalDate: string | null; lastContactDate: string | null;
  crisisCount: number;
}

function buildSummaryPrompt(data: TeenData): string {
  return `Genera un resumen pastoral inteligente para el adolescente ${data.nombre} ${data.apellido}.
Responde ÚNICAMENTE con JSON válido en este formato:
{
  "summary": "resumen ejecutivo de 2-3 párrafos en español, cubriendo: situación actual de asistencia, patrones emocionales/vulnerabilidades detectadas, progreso en contactos y acompañamiento",
  "pastoralMomentum": "una frase que describa la tendencia general: 'Mejorando', 'Estable', 'Requiere atención' o 'En declive'",
  "mainChallenge": "el principal desafío pastoral detectado (una frase corta)",
  "recommendedFocus": "recomendación concreta para la próxima interacción pastoral"
}

Datos del adolescente:
- Asistencia: ${data.pct}% (${data.presentAttendance}/${data.totalAttendance} registros)
- Faltas consecutivas: ${data.consecAbsences}
- Análisis de IA realizados: ${data.analysesCount} (${data.highRiskCount} de alto riesgo)
- Tags de vulnerabilidad más frecuentes: ${data.topTags.join(", ") || "ninguno"}
- Bitácoras escritas: ${data.journalCount}
- Registros en campaña de contactos: ${data.contactCount}
- Alertas de crisis: ${data.crisisCount}
- Última bitácora: ${data.lastJournalDate || "ninguna"}
- Último contacto: ${data.lastContactDate || "ninguno"}
- Intereses: ${data.gustos || "no registrados"}`;
}

function parseSummary(raw: string): {
  summary: string;
  pastoralMomentum: string;
  mainChallenge: string;
  recommendedFocus: string;
} | null {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      pastoralMomentum: typeof parsed.pastoralMomentum === "string" ? parsed.pastoralMomentum : "",
      mainChallenge: typeof parsed.mainChallenge === "string" ? parsed.mainChallenge : "",
      recommendedFocus: typeof parsed.recommendedFocus === "string" ? parsed.recommendedFocus : "",
    };
  } catch {
    return null;
  }
}

export const generateTeenSummary = action({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const data = await ctx.runQuery(internal.ai.getTeenData, { teenId: args.teenId });
    if (!data) return { success: false, error: "Teen not found" };

    const prompt = buildSummaryPrompt(data);
    let result: ReturnType<typeof parseSummary> = null;
    let modelUsed = "";

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (!raw) continue;
      result = parseSummary(raw);
      if (result) {
        modelUsed = model;
        break;
      }
    }

    if (!result) return { success: false, error: "All models failed for summary" };

    await ctx.runMutation(internal.ai.storeTeenSummary, {
      teenId: args.teenId,
      ...result,
      modelUsed,
    });

    return { success: true, ...result, modelUsed };
  },
});

export const storeTeenSummary = internalMutation({
  args: {
    teenId: v.id("teens"),
    summary: v.string(),
    pastoralMomentum: v.string(),
    mainChallenge: v.string(),
    recommendedFocus: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teenSummaries")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        generatedAt: new Date().toISOString(),
      });
    } else {
      await ctx.db.insert("teenSummaries", {
        ...args,
        generatedAt: new Date().toISOString(),
      });
    }
  },
});

export const getTeenSummary = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teenSummaries")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .first();
  },
});

function buildDropoutPrompt(data: TeenData): string {
  return `Eres un asesor pastoral experto en prevención de abandono juvenil. Analiza los datos del adolescente ${data.nombre} ${data.apellido} y predice su riesgo de abandono del ministerio.
Responde ÚNICAMENTE con JSON válido en este formato:
{
  "probability": 0-100,
  "riskLevel": "low|medium|high",
  "primaryFactor": "factor principal detectado (una frase corta)",
  "recommendation": "recomendación pastoral concreta para retener al adolescente"
}

Datos del adolescente:
- Asistencia: ${data.pct}% (${data.presentAttendance}/${data.totalAttendance} registros)
- Faltas consecutivas: ${data.consecAbsences}
- Análisis de IA: ${data.analysesCount} totales, ${data.highRiskCount} de alto riesgo
- Tags de vulnerabilidad: ${data.topTags.join(", ") || "ninguno"}
- Bitácoras escritas: ${data.journalCount}
- Registros en campaña de contactos: ${data.contactCount}
- Alertas de crisis: ${data.crisisCount}
- Última bitácora: ${data.lastJournalDate || "ninguna"}
- Último contacto: ${data.lastContactDate || "ninguno"}
- Intereses: ${data.gustos || "no registrados"}

Probabilidad debe ser un número entero entre 0 y 100.
riskLevel: "low" si probability < 30, "medium" si 30-69, "high" si >= 70.`;
}

function parseDropout(raw: string): {
  probability: number;
  riskLevel: "low" | "medium" | "high";
  primaryFactor: string;
  recommendation: string;
} | null {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const p = Math.max(0, Math.min(100, Math.round(Number(parsed.probability) || 0)));
    let rl = parsed.riskLevel;
    if (!["low", "medium", "high"].includes(rl)) {
      rl = p < 30 ? "low" : p < 70 ? "medium" : "high";
    }
    return {
      probability: p,
      riskLevel: rl,
      primaryFactor: typeof parsed.primaryFactor === "string" ? parsed.primaryFactor : "",
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "",
    };
  } catch {
    return null;
  }
}

export const predictDropout = action({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const data = await ctx.runQuery(internal.ai.getTeenData, { teenId: args.teenId });
    if (!data) return { success: false, error: "Teen not found" };

    const prompt = buildDropoutPrompt(data);
    let result: ReturnType<typeof parseDropout> = null;
    let modelUsed = "";

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (!raw) continue;
      result = parseDropout(raw);
      if (result) {
        modelUsed = model;
        break;
      }
    }

    if (!result) return { success: false, error: "All models failed" };

    await ctx.runMutation(internal.ai.storeDropoutPrediction, {
      teenId: args.teenId,
      ...result,
      modelUsed,
    });

    return { success: true, ...result, modelUsed };
  },
});

export const storeDropoutPrediction = internalMutation({
  args: {
    teenId: v.id("teens"),
    probability: v.number(),
    riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    primaryFactor: v.string(),
    recommendation: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dropoutPredictions")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, generatedAt: new Date().toISOString() });
    } else {
      await ctx.db.insert("dropoutPredictions", { ...args, generatedAt: new Date().toISOString() });
    }
  },
});

export const getDropoutPrediction = query({
  args: { teenId: v.id("teens") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dropoutPredictions")
      .withIndex("by_teenId", (q) => q.eq("teenId", args.teenId))
      .first();
  },
});

export const getAllDropoutPredictions = query({
  handler: async (ctx) => {
    return await ctx.db.query("dropoutPredictions").order("desc").collect();
  },
});

export const getMinistryOverviewData = internalQuery({
  handler: async (ctx) => {
    const teens = await ctx.db.query("teens").collect();
    const analyses = await ctx.db.query("journalAnalysis").order("desc").collect();
    const attendance = await ctx.db.query("attendance").collect();
    const journal = await ctx.db.query("journal").order("desc").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const followUps = journal.filter((j) => j.followUp);

    const teenSummaries = teens.map((t) => {
      const teenAttendance = attendance.filter((a) => a.teenId === t._id);
      const total = teenAttendance.length;
      const present = teenAttendance.filter((a) => a.status === "present").length;
      const pct = total ? Math.round((present / total) * 100) : 0;
      const sorted = [...teenAttendance].sort((a, b) => b.date.localeCompare(a.date));
      let consecAbsences = 0;
      for (const r of sorted) { if (r.status === "absent") consecAbsences++; else break; }
      const teenAnalyses = analyses.filter((a) => a.teenId === t._id);
      const crisisCount = teenAnalyses.filter((a) => a.isCrisis).length;
      const highRiskCount = teenAnalyses.filter((a) => a.riskLevel === "high").length;
      const tags = [...new Set(teenAnalyses.flatMap((a) => a.vulnerabilityTags))];
      const teenContacts = contacts.filter((c) => c.teenId === t._id);
      const lastContacted = teenContacts.find((c) => c.status === "contacted");
      const journalCount = journal.filter((j) => j.teenId === t._id).length;
      return {
        nombre: t.nombre,
        apellido: t.apellido,
        _id: t._id,
        attendancePct: pct,
        consecAbsences,
        riskLevel: highRiskCount > 0 ? "high" : teenAnalyses.some((a) => a.riskLevel === "medium") ? "medium" : "low",
        crisisCount,
        tags,
        hasFollowUp: followUps.some((f) => f.teenId === t._id),
        lastContactedDate: lastContacted?.contactedAt || null,
        journalCount,
        totalAnalyses: teenAnalyses.length,
      };
    });

    const tagFrequency: Record<string, number> = {};
    for (const a of analyses) {
      for (const tag of a.vulnerabilityTags || []) {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      }
    }

    return {
      teens: teenSummaries,
      totalTeens: teens.length,
      totalAnalyses: analyses.length,
      totalCrisisAlerts: analyses.filter((a) => a.isCrisis).length,
      totalFollowUps: followUps.length,
      overallAttendanceAvg: teenSummaries.length
        ? Math.round(teenSummaries.reduce((s, t) => s + t.attendancePct, 0) / teenSummaries.length)
        : 0,
      tagFrequency,
      highRiskCount: teenSummaries.filter((t) => t.riskLevel === "high").length,
      pendingContactCount: contacts.filter((c) => c.status === "pending").length,
    };
  },
});

export const chatWithAI = action({
  args: {
    question: v.string(),
    conversationHistory: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const data = await ctx.runQuery(internal.ai.getMinistryOverviewData);

    const contextData = JSON.stringify({
      ministerio: "Adolescentes Cristo Vive",
      totalAdolescentes: data.totalTeens,
      asistenciaPromedio: `${data.overallAttendanceAvg}%`,
      alertasCrisis: data.totalCrisisAlerts,
      seguimientosPendientes: data.totalFollowUps,
      analisisIA: data.totalAnalyses,
      altoRiesgo: data.highRiskCount,
      contactosPendientes: data.pendingContactCount,
      adolescentes: data.teens.map((t) => ({
        nombre: t.nombre,
        apellido: t.apellido,
        asistencia: `${t.attendancePct}%`,
        faltasConsecutivas: t.consecAbsences,
        nivelRiesgo: t.riskLevel,
        alertasCrisis: t.crisisCount,
        vulnerabilidades: t.tags,
        requiereSeguimiento: t.hasFollowUp,
        ultimoContacto: t.lastContactedDate || "nunca",
        bitacoras: t.journalCount,
        analisisIA: t.totalAnalyses,
      })),
      frecuenciaTags: data.tagFrequency,
    });

    const systemPrompt = `Eres un asistente pastoral virtual para el ministerio de adolescentes "Cristo Vive". 
Tienes acceso a datos reales del ministerio en formato JSON. Responde las preguntas del líder pastoral basándote ÚNICAMENTE en los datos proporcionados.
SIEMPRE responde en español, con un tono pastoral y profesional.
NO inventes datos que no estén en el JSON. Si no sabes algo, dilo honestamente.
NO uses JSON en tu respuesta — responde en lenguaje natural.
Puedes hacer cálculos simples con los datos (contar, sumar, promediar).
Datos del ministerio:
${contextData}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(args.conversationHistory || []).slice(-10),
      { role: "user", content: args.question },
    ];

    for (const model of FREE_MODELS) {
      const raw = await callModelRaw(apiKey, model, messages, 1000);
      if (raw) return { success: true, answer: raw, modelUsed: model };
    }
    return { success: false, error: "All models failed" };
  },
});

async function callModelRaw(apiKey: string, model: string, messages: { role: string; content: string }[], maxTokens: number): Promise<string | null> {
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
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

export const generateActivityRecommendations = action({
  handler: async (ctx) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const data = await ctx.runQuery(internal.ai.getMinistryOverviewData);

    const prompt = `Eres un asesor de ministerio juvenil. Basado en los datos de vulnerabilidades y riesgo del ministerio, genera recomendaciones de actividades, talleres y estudios bíblicos.

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "recommendations": [
    {
      "title": "título de la actividad",
      "type": "taller | estudio | actividad | campaña",
      "description": "descripción detallada de 2-3 oraciones",
      "bibleVerse": "Libro Capítulo:Versículo",
      "targetTags": ["tags relacionadas"],
      "urgency": "baja | media | alta"
    }
  ]
}

Genera de 3 a 5 recomendaciones.

Datos del ministerio:
- Total adolescentes: ${data.totalTeens}
- Asistencia promedio: ${data.overallAttendanceAvg}%
- Alertas de crisis: ${data.totalCrisisAlerts}
- Seguimientos pendientes: ${data.totalFollowUps}
- Adolescentes en alto riesgo: ${data.highRiskCount}
- Contactos pendientes: ${data.pendingContactCount}

Frecuencia de tags de vulnerabilidad:
${Object.entries(data.tagFrequency)
  .sort((a, b) => b[1] - a[1])
  .map(([tag, count]) => `- ${tag}: ${count}`)
  .join("\n")}`;

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (!raw) continue;
      try {
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.recommendations)) {
          return { success: true, recommendations: parsed.recommendations, modelUsed: model };
        }
      } catch {
        continue;
      }
    }
    return { success: false, error: "All models failed" };
  },
});

export const generatePersonalizedMessage = action({
  args: {
    teenId: v.id("teens"),
    tone: v.union(v.literal("aliento"), v.literal("correccion"), v.literal("invitacion"), v.literal("celebracion")),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const data = await ctx.runQuery(internal.ai.getTeenData, { teenId: args.teenId });
    if (!data) return { success: false, error: "Teen not found" };

    const toneLabels: Record<string, string> = {
      aliento: "ánimo y aliento",
      correccion: "corrección amorosa",
      invitacion: "invitación cordial",
      celebracion: "celebración y felicitación",
    };

    const prompt = `Eres un asistente pastoral. Redacta un mensaje personalizado de ${toneLabels[args.tone]} para ${data.nombre} ${data.apellido}, un adolescente del ministerio juvenil.
Responde ÚNICAMENTE con el texto del mensaje en español, sin JSON, sin formato adicional. Usa un tono natural y cercano, como de un líder juvenil.

Contexto del adolescente:
- Asistencia: ${data.pct}% (${data.presentAttendance}/${data.totalAttendance} registros)
- Faltas consecutivas: ${data.consecAbsences}
- Vulnerabilidades detectadas: ${data.topTags.join(", ") || "ninguna"}
- Intereses: ${data.gustos || "no registrados"}
- Alertas de crisis: ${data.crisisCount > 0 ? "SÍ (manejar con cuidado)" : "ninguna"}

El mensaje debe ser de aproximadamente 3-4 oraciones, en español, firmado como "Tu líder".`;

    let message = "";
    let modelUsed = "";
    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (raw) {
        message = raw.replace(/```\s*/g, "").trim();
        modelUsed = model;
        break;
      }
    }

    if (!message) return { success: false, error: "All models failed" };
    return { success: true, message, modelUsed };
  },
});

export const structureTranscription = action({
  args: {
    rawText: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const prompt = `Eres un asistente pastoral. Estructura la siguiente transcripción de voz de una bitácora de acompañamiento juvenil.
Responde ÚNICAMENTE con JSON válido en este formato:
{
  "structuredContent": "texto corregido y estructurado con viñetas si aplica, en español",
  "suggestedCategory": "call | visit | chat | counseling | prayer | other",
  "summary": "resumen de 1 oración",
  "followUpNeeded": true | false
}

Transcripción original:
${args.rawText}`;

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (!raw) continue;
      try {
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return {
          success: true,
          structuredContent: typeof parsed.structuredContent === "string" ? parsed.structuredContent : args.rawText,
          suggestedCategory: ["call", "visit", "chat", "counseling", "prayer", "other"].includes(parsed.suggestedCategory) ? parsed.suggestedCategory : "other",
          summary: typeof parsed.summary === "string" ? parsed.summary : "",
          followUpNeeded: parsed.followUpNeeded === true,
          modelUsed: model,
        };
      } catch {
        continue;
      }
    }
    return { success: false, error: "All models failed" };
  },
});
