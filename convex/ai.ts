import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getEffectiveAccess, filterTeensByScope } from "./authz";
import { getUserFromToken } from "./authHelper";
import { logAudit } from "./auditLog";

const FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "cohere/north-mini-code:free",
  "google/gemini-2.5-flash", // Fallback premium
];

const PASTORAL_DISCLAIMER = "Esta sugerencia no es un diagnóstico y requiere revisión humana pastoral.";
const optionalCampusId = v.optional(v.union(v.id("campus"), v.literal("")));
const optionalMinistryId = v.optional(v.union(v.id("ministry"), v.literal("")));
const optionalGroupId = v.optional(v.union(v.id("group"), v.literal("")));

function matchesActiveScope(record: { campusId?: any; ministryId?: any; groupId?: any }, scope: { campusId?: any; ministryId?: any; groupId?: any }) {
  if (scope.groupId) return String(record.groupId || "") === String(scope.groupId);
  if (scope.ministryId) return String(record.ministryId || "") === String(scope.ministryId);
  if (scope.campusId) return String(record.campusId || "") === String(scope.campusId);
  return true;
}

const PASTORAL_STYLE_GUIDE = `Guía de lenguaje pastoral:
- Escribe con tono humano, cercano, sobrio y respetuoso.
- Separa hechos observados de interpretaciones pastorales.
- No copies texto crudo cuando puedas resumirlo con claridad.
- No diagnostiques ni uses lenguaje clínico como conclusión.
- No afirmes intenciones, heridas o estados internos como hechos.
- Usa expresiones prudentes: "podría indicar", "conviene conversar", "se observa una señal".
- Evita lenguaje alarmista, sentencias absolutas y etiquetas frías.
- Sugiere acciones concretas, realizables y pastoralmente responsables.`;

const JOURNAL_STRUCTURE_TEMPLATE = `Motivo del contacto:
...

Respuesta recibida:
...

Observación pastoral:
...

Próxima acción sugerida:
...`;

const SYSTEM_PROMPT = `Eres una herramienta de apoyo pastoral para líderes de adolescentes. Analiza bitácoras de acompañamiento juvenil.
${PASTORAL_STYLE_GUIDE}

Límites obligatorios:
- No diagnostiques condiciones clínicas.
- No reemplaces al pastor, líder, coordinador ni apoderado.
- No tomes decisiones finales, no cierres alertas y no derives casos.
- No generes conclusiones absolutas.
- Evita lenguaje alarmista.
- Usa lenguaje de señales de cuidado, posibilidades y sugerencias prudentes.
- Toda alerta o riesgo debe indicar que requiere revisión humana.
- Explica por qué sugieres el nivel de riesgo y qué datos usaste.
Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "vulnerabilityTags": ["array", "de", "tags"],
  "riskLevel": "low|medium|high",
  "confidence": "low|medium|high",
  "humanReviewRequired": true,
  "reasoningSummary": "motivo breve de la sugerencia, sin diagnosticar",
  "usedDataSources": ["journal"],
  "isCrisis": false,
  "crisisSeverity": "low|medium|high|critical|null",
  "suggestedActions": ["acción pastoral concreta 1", "acción pastoral concreta 2"],
  "suggestedVerses": ["Libro Capítulo:Versículo", "Libro Capítulo:Versículo"],
  "summary": "resumen de 1-2 oraciones en español",
  "pastoralDisclaimer": "${PASTORAL_DISCLAIMER}"
}

Tags disponibles: salud_mental, familiar, adiccion, duelo, espiritual, academico, violencia, relaciones, fisico, economico
Si no hay suficiente contenido, usa riskLevel "low" y array vacío para tags.

CRITERIOS DE CRISIS: isCrisis=true SOLO si el contenido indica PELIGRO INMEDIATO: ideación suicida, autolesión, violencia activa, abuso en curso, amenaza grave. Si no hay indicios claros, isCrisis=false y crisisSeverity=null. Si isCrisis=true, sugiere crisisSeverity, pero la decisión final corresponde al equipo pastoral.`;

function buildPrompt(content: string, category: string): string {
  return `Categoría: ${category}
Contenido de la bitácora:
${content}

Analiza esta entrada pastoral y devuelve el JSON requerido.
Redacta el resumen, motivo y acciones con lenguaje humano, pastoral y prudente.
No copies frases crudas si puedes resumirlas con claridad.`;
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
    return sanitizeModelText(data?.choices?.[0]?.message?.content || null);
  } catch {
    return null;
  }
}

function sanitizeModelText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/<\/?pad>/gi, "")
    .replace(/<pad>/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBulletNoise(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\bwhatsa+pp\b/gi, "WhatsApp")
    .replace(/\bwhatss?app\b/gi, "WhatsApp")
    .replace(/\bwasap\b/gi, "WhatsApp")
    .replace(/\b0(\d)\b/g, "$1")
    .replace(/^[ \t]*[-•]\s*[-•]\s*/gm, "- ")
    .replace(/[ \t]+[-•][ \t]+/g, ". ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizePastoralAiText(text: string): string {
  return text
    .replace(/tiene depresi[oó]n/gi, "presenta señales de desánimo que requieren conversación y revisión humana")
    .replace(/depresi[oó]n cl[ií]nica/gi, "señales de desánimo")
    .replace(/trastorno/gi, "situación")
    .replace(/diagn[oó]stico/gi, "sugerencia pastoral")
    .replace(/ansiedad severa/gi, "preocupación intensa")
    .replace(/est[aá] en peligro/gi, "requiere revisión cuidadosa")
    .replace(/seguramente/gi, "podría")
    .replace(/definitivamente/gi, "podría")
    .replace(/requiere tratamiento/gi, "requiere acompañamiento y evaluación humana responsable")
    .replace(/caso confirmado/gi, "señal por revisar");
}

function sanitizeHumanPastoralText(text: string): string {
  return normalizeBulletNoise(sanitizePastoralAiText(text))
    .replace(/tiene heridas/gi, "podría haber aspectos que conviene conversar con cuidado")
    .replace(/est[aá] teniendo pensamientos/gi, "se observan expresiones que podrían requerir conversación")
    .replace(/centrados en s[ií] misma/gi, "de mayor enfoque personal")
    .replace(/ya no en los dem[aá]s/gi, "y conviene escuchar cómo se está sintiendo")
    .replace(/\bse identifica que\b/gi, "se observa que")
    .replace(/\bes posible que\b/gi, "podría")
    .replace(/\bmanifest[oó]\b/gi, "comentó")
    .replace(/\bargumentando que\b/gi, "indicó que")
    .replace(/\b02\b/g, "2")
    .trim();
}

function sanitizePastoralArray(values: string[]): string[] {
  return values.map((value) => sanitizeHumanPastoralText(value)).filter(Boolean);
}

function parseAnalysis(raw: string): {
  vulnerabilityTags: string[];
  riskLevel: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  humanReviewRequired: boolean;
  reasoningSummary: string;
  usedDataSources: string[];
  isCrisis: boolean;
  crisisSeverity?: "low" | "medium" | "high" | "critical";
  suggestedActions: string[];
  suggestedVerses: string[];
  summary: string;
  pastoralDisclaimer: string;
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
      confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
      humanReviewRequired: true,
      reasoningSummary: sanitizeHumanPastoralText(typeof parsed.reasoningSummary === "string" ? parsed.reasoningSummary : "La IA no explicó el motivo; requiere revisión humana."),
      usedDataSources: Array.isArray(parsed.usedDataSources) ? parsed.usedDataSources.filter((s: any) => typeof s === "string") : ["journal"],
      isCrisis: parsed.isCrisis === true,
      crisisSeverity: ["low", "medium", "high", "critical"].includes(parsed.crisisSeverity) ? parsed.crisisSeverity : undefined,
      suggestedActions: Array.isArray(parsed.suggestedActions) ? sanitizePastoralArray(parsed.suggestedActions) : [],
      suggestedVerses: Array.isArray(parsed.suggestedVerses) ? parsed.suggestedVerses : [],
      summary: sanitizeHumanPastoralText(typeof parsed.summary === "string" ? parsed.summary : ""),
      pastoralDisclaimer: PASTORAL_DISCLAIMER,
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
    confidence: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    humanReviewRequired: v.boolean(),
    reasoningSummary: v.string(),
    usedDataSources: v.array(v.string()),
    pastoralDisclaimer: v.string(),
    suggestedActions: v.array(v.string()),
    suggestedVerses: v.array(v.string()),
    summary: v.string(),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("journalAnalysis", {
      ...args,
      reviewStatus: "pending",
      analyzedAt: new Date().toISOString(),
    });
  },
});

export const getJournalEntryData = internalQuery({
  args: { entryId: v.id("journal") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.entryId);
  },
});

function localConfidentialAnalysis(content: string, category: string) {
  const text = content.toLowerCase();
  const tags: string[] = [];
  
  if (/(suicid|matar|morir|autoles|cortar|hacerse daño)/.test(text)) {
    return {
      vulnerabilityTags: ["salud_mental"],
      riskLevel: "high" as const,
      isCrisis: true,
      confidence: "medium" as const,
      humanReviewRequired: true,
      reasoningSummary: "La entrada contiene posibles señales de peligro inmediato que requieren revisión humana urgente.",
      usedDataSources: ["journal"],
      suggestedActions: ["Contactar urgentemente al pastor responsable", "Activar protocolo de acompañamiento profesional"],
      suggestedVerses: ["Salmos 34:18"],
      summary: "Entrada confidencial. Se observaron señales críticas que requieren revisión humana inmediata.",
      pastoralDisclaimer: PASTORAL_DISCLAIMER,
    };
  }

  if (/(papá|mamá|padres|familia|hermano|tío|abuela)/.test(text)) tags.push("familiar");
  if (/(alcohol|droga|vicio|adicto|tomar)/.test(text)) tags.push("adiccion");
  if (/(triste|depre|llor|ansie|miedo|solo)/.test(text)) tags.push("salud_mental");
  if (/(escuela|colegio|tarea|examen|reprob)/.test(text)) tags.push("academico");
  if (/(golpe|pegar|violencia|abuso|maltrato)/.test(text)) tags.push("violencia");
  if (/(dinero|pobre|trabajo|comprar|pagar)/.test(text)) tags.push("economico");

  const isHighRisk = /(suicid|matar|morir|autoles|abuso|violenc)/.test(text);
  const isMediumRisk = tags.length > 1 || /(triste|depre|ansie|alcohol|droga)/.test(text);

  return {
    vulnerabilityTags: tags.length > 0 ? tags : ["espiritual"],
    riskLevel: (isHighRisk ? "high" : isMediumRisk ? "medium" : "low") as "low" | "medium" | "high",
    isCrisis: isHighRisk,
    confidence: tags.length > 0 ? "medium" as const : "low" as const,
    humanReviewRequired: true,
    reasoningSummary: tags.length > 0 ? `La bitácora contiene señales relacionadas con: ${tags.join(", ")}.` : "Hay poca información contextual; se requiere revisión humana.",
    usedDataSources: ["journal"],
    suggestedActions: [
      "Brindar escucha activa en confidencialidad.",
      "Mantener en oración y programar una conversación de seguimiento."
    ],
    suggestedVerses: ["Filipenses 4:6-7"],
    summary: "Entrada confidencial. Acompañamiento pastoral registrado de manera privada.",
    pastoralDisclaimer: PASTORAL_DISCLAIMER,
  };
}

export const analyzeJournalEntry = action({
  args: {
    entryId: v.id("journal"),
    teenId: v.id("teens"),
    content: v.string(),
    category: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verificar si la entrada es confidencial
    const entry = await ctx.runQuery(internal.ai.getJournalEntryData, { entryId: args.entryId });
    
    let result: ReturnType<typeof parseAnalysis> = null;
    let modelUsed = "";

    if (entry?.isConfidential) {
      result = localConfidentialAnalysis(args.content, args.category);
      modelUsed = "local-confidential-rules";
    } else {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) return { success: false, error: "No API key configured" };

      const prompt = buildPrompt(args.content, args.category);
      for (const model of FREE_MODELS) {
        const raw = await callModel(apiKey, model, prompt);
        if (!raw) continue;
        result = parseAnalysis(raw);
        if (result) {
          modelUsed = model;
          break;
        }
      }
    }

    if (!result) {
      return { success: false, error: "All models failed" };
    }

    const { crisisSeverity, ...analysisResult } = result;
    const analysisId = await ctx.runMutation(internal.ai.storeAnalysis, {
      entryId: args.entryId,
      teenId: args.teenId,
      ...analysisResult,
      modelUsed,
    });

    if (result.isCrisis) {
      await ctx.runMutation(internal.crisis.createAlert, {
        analysisId,
        teenId: args.teenId,
        summary: result.summary,
        riskLevel: result.riskLevel,
        severity: crisisSeverity,
      });
    }
    await ctx.runMutation(internal.auditLog.logInternal, {
      token: args.token,
      action: "ai.analysis.generated",
      entityType: "journal",
      entityId: args.entryId,
      newValue: {
        teenId: args.teenId,
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        humanReviewRequired: true,
        reasoningSummary: result.reasoningSummary,
        usedDataSources: result.usedDataSources,
        isCrisis: result.isCrisis,
        modelUsed,
      },
      details: "Analisis IA de bitacora generado.",
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
  args: { token: v.string(), campusId: optionalCampusId, ministryId: optionalMinistryId, groupId: optionalGroupId },
  handler: async (ctx, args) => {
    const access = await getEffectiveAccess(ctx, args.token);
    if (!access) throw new Error("No autenticado");
    const scope = { campusId: args.campusId || undefined, ministryId: args.ministryId || undefined, groupId: args.groupId || undefined };
    const teens = filterTeensByScope(access, await ctx.db.query("teens").collect()).filter((teen) => matchesActiveScope(teen, scope));
    const teenIds = new Set(teens.map((teen) => String(teen._id)));
    return (await ctx.db.query("journalAnalysis").order("desc").collect()).filter((analysis) => teenIds.has(String(analysis.teenId)));
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
${PASTORAL_STYLE_GUIDE}

Responde ÚNICAMENTE con JSON válido:
{
  "totalEntries": number,
  "mainConcerns": "párrafo corto, humano y prudente con las principales señales de cuidado",
  "emotionalClimate": "descripción sobria del clima emocional general, sin diagnosticar",
  "riskDistribution": { "low": number, "medium": number, "high": number },
  "topTags": ["tag1", "tag2"],
  "recommendation": "recomendación pastoral concreta para el equipo de líderes esta semana"
}

NO uses nombres propios en el resumen.
No conviertas señales en conclusiones absolutas.

Bitácoras de la semana:
${args.entries.map((e, i) => `[${i + 1}] (${e.entryDate}, ${e.category}): ${e.content}`).join("\n")}`;

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, weeklyPrompt);
      if (!raw) continue;
      try {
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return {
          success: true,
          summary: {
            ...parsed,
            mainConcerns: typeof parsed.mainConcerns === "string" ? sanitizeHumanPastoralText(parsed.mainConcerns) : "",
            emotionalClimate: typeof parsed.emotionalClimate === "string" ? sanitizeHumanPastoralText(parsed.emotionalClimate) : "",
            recommendation: typeof parsed.recommendation === "string" ? sanitizeHumanPastoralText(parsed.recommendation) : "",
          },
          modelUsed: model,
        };
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
      recentJournals: journal.slice(0, 5).map((j) => ({
        entryDate: j.entryDate,
        category: j.category,
        content: j.content,
        leaderName: j.leaderName || "Líder",
        isConfidential: j.isConfidential === true,
      })),
      telefono: teen?.telefono || "",
      _id: args.teenId,
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
  recentJournals: Array<{
    entryDate: string;
    category: string;
    content: string;
    leaderName: string;
    isConfidential: boolean;
  }>;
  telefono: string;
  _id: string;
}

interface MinistryOverviewData {
  teens: Array<{
    nombre: string;
    apellido: string;
    _id: string;
    attendancePct: number;
    consecAbsences: number;
    riskLevel: string;
    crisisCount: number;
    tags: string[];
    hasFollowUp: boolean;
    lastContactedDate: string | null;
    journalCount: number;
    totalAnalyses: number;
  }>;
  totalTeens: number;
  totalAnalyses: number;
  totalCrisisAlerts: number;
  totalFollowUps: number;
  overallAttendanceAvg: number;
  tagFrequency: Record<string, number>;
  highRiskCount: number;
  pendingContactCount: number;
}

function applyActiveScope<T extends { campusId?: any; ministryId?: any; groupId?: any }>(
  items: T[],
  activeScope?: { campusId?: string; ministryId?: string; groupId?: string }
): T[] {
  if (!activeScope) return items;
  return items.filter((item) => {
    if (activeScope.groupId) return item.groupId?.toString() === activeScope.groupId;
    if (activeScope.ministryId) return item.ministryId?.toString() === activeScope.ministryId;
    if (activeScope.campusId) return item.campusId?.toString() === activeScope.campusId;
    return true;
  });
}

function buildFallbackPastoralResponse(data: MinistryOverviewData, question: string): string {
  const q = question.toLowerCase();
  const highRiskTeens = data.teens.filter((t) => t.riskLevel === "high");
  const absentTeens = [...data.teens]
    .filter((t) => t.consecAbsences > 0)
    .sort((a, b) => b.consecAbsences - a.consecAbsences)
    .slice(0, 5);
  const noContactTeens = data.teens
    .filter((t) => !t.lastContactedDate || t.lastContactedDate === "nunca")
    .slice(0, 5);
  const topTags = (Object.entries(data.tagFrequency) as Array<[string, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (q.includes("hola") || q.includes("buenas") || q.includes("saludos")) {
    return `Hola. En este momento tengo ${data.totalTeens} adolescentes registrados, una asistencia promedio de ${data.overallAttendanceAvg}% y ${data.highRiskCount} adolescentes en riesgo alto. Si quieres, puedo ayudarte a revisar riesgo, ausencias, seguimientos o vulnerabilidades principales del ministerio.`;
  }

  if (q.includes("modelo") || q.includes("openrouter") || q.includes("google") || q.includes("proveedor") || q.includes("ia usas")) {
    return "Estoy configurado como asistente pastoral del ministerio y debo enfocarme en ayudarte con informacion autorizada del contexto pastoral. No comparto detalles tecnicos internos del modelo o proveedor, pero si puedo ayudarte a revisar riesgo, seguimientos, ausencias y prioridades del ministerio dentro de tu alcance.";
  }

  if (q.includes("riesgo alto") || q.includes("alto riesgo") || q.includes("riesgo")) {
    if (highRiskTeens.length === 0) {
      return "En este momento no veo adolescentes clasificados en riesgo alto. Aun asi, conviene revisar los seguimientos pendientes y las faltas consecutivas para detectar casos emergentes.";
    }
    return `Detecto ${highRiskTeens.length} adolescentes en riesgo alto: ${highRiskTeens.map((t) => `${t.nombre} ${t.apellido}`).join(", ")}. Mi recomendacion pastoral es priorizar contacto esta semana con ellos y revisar si hay alertas de crisis, faltas consecutivas o vulnerabilidades repetidas.`;
  }

  if (q.includes("falt") || q.includes("ausen") || q.includes("inasistencia")) {
    if (absentTeens.length === 0) {
      return `No veo adolescentes con faltas consecutivas registradas en este momento. La asistencia promedio general es de ${data.overallAttendanceAvg}%.`;
    }
    return `Los casos con mas ausencias consecutivas son: ${absentTeens.map((t) => `${t.nombre} ${t.apellido} (${t.consecAbsences})`).join(", ")}. Esto sugiere priorizar seguimiento relacional y confirmar si hay barreras familiares, emocionales o de transporte.`;
  }

  if (q.includes("contact") || q.includes("seguimiento")) {
    const intro = `Actualmente hay ${data.totalFollowUps} seguimientos pendientes y ${data.pendingContactCount} contactos pendientes.`;
    if (noContactTeens.length === 0) {
      return `${intro} No identifico adolescentes sin contacto registrado reciente dentro de los datos disponibles.`;
    }
    return `${intro} Entre los adolescentes sin contacto registrado reciente aparecen: ${noContactTeens.map((t) => `${t.nombre} ${t.apellido}`).join(", ")}. Sugeriria empezar por quienes ademas tengan riesgo alto o faltas consecutivas.`;
  }

  if (q.includes("vulnerab") || q.includes("comunes") || q.includes("tags")) {
    if (topTags.length === 0) {
      return "Todavia no hay suficientes analisis de vulnerabilidad para detectar patrones comunes en el ministerio.";
    }
    return `Las vulnerabilidades mas frecuentes en los analisis son: ${topTags.map(([tag, count]) => `${tag} (${count})`).join(", ")}. Esto puede ayudarte a planificar acompanamiento, talleres y conversaciones pastorales mas focalizadas.`;
  }

  return `Puedo darte un panorama general: hay ${data.totalTeens} adolescentes, asistencia promedio de ${data.overallAttendanceAvg}%, ${data.highRiskCount} en riesgo alto, ${data.totalCrisisAlerts} alertas de crisis y ${data.totalFollowUps} seguimientos pendientes. Si quieres una respuesta mas puntual, preguntame por riesgo alto, ausencias, seguimientos o vulnerabilidades.`;
}

function inferCategoryFromText(rawText: string): "call" | "visit" | "chat" | "counseling" | "prayer" | "other" {
  const text = rawText.toLowerCase();
  if (/(llam|telefone|celular|telefono)/.test(text)) return "call";
  if (/(visita|fu[ií]|casa|domicilio)/.test(text)) return "visit";
  if (/(whatsapp|mensaje|chat|escrib[ií])/.test(text)) return "chat";
  if (/(consejer|aconsej|orientac|escuch)/.test(text)) return "counseling";
  if (/(or[ée]|oracion|oramos|orar)/.test(text)) return "prayer";
  return "other";
}

function splitPastoralNotes(rawText: string): string[] {
  return normalizeBulletNoise(rawText)
    .replace(/\s+-\s+/g, ". ")
    .replace(/\s+(Que|Y|Si|Se le|En los estados)\s+/g, ". $1 ")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => sanitizeHumanPastoralText(part.replace(/^[-•]\s*/, "")))
    .filter((part) => part.length > 8);
}

function pickSentences(parts: string[], matcher: RegExp, limit = 2): string[] {
  return parts.filter((part) => matcher.test(part)).slice(0, limit);
}

function joinHumanSentences(parts: string[], fallback: string): string {
  const unique = [...new Set(parts.map((part) => part.replace(/\.$/, "").trim()).filter(Boolean))];
  if (unique.length === 0) return fallback;
  return unique.slice(0, 3).map((part) => `${part}.`).join(" ");
}

function structureTranscriptionFallback(rawText: string) {
  const normalized = normalizeBulletNoise(rawText);
  const sentenceParts = splitPastoralNotes(normalized);
  const absenceParts = pickSentences(sentenceParts, /(falta|ausencia|no asist|no vino|no viene|inasistencia)/i, 2);
  const guardianParts = pickSentences(sentenceParts, /(madre|padre|apoderad|tutor|familia)/i, 2);
  const schoolParts = pickSentences(sentenceParts, /(colegio|tarea|trabajo grupal|vacaciones|estudio|escuela)/i, 3);
  const sensitiveParts = pickSentences(sentenceParts, /(estado|WhatsApp|pensamiento|autosuficiencia|herida|conversaci[oó]n personal|des[aá]nimo)/i, 2);
  const followUpNeeded = /(seguir|acompañar|acompanar|volver|pendiente|orar|visitar|llamar|contactar)/i.test(normalized);
  const contactReason = absenceParts.length > 0
    ? "Se registró contacto pastoral para conocer el motivo de ausencias recientes y saber cómo se encuentra el adolescente."
    : "Se registró una interacción de acompañamiento pastoral.";
  const response = joinHumanSentences(
    [...schoolParts, ...guardianParts],
    joinHumanSentences(sentenceParts.slice(0, 2), "No se especifica una respuesta concreta en el texto original.")
  );
  const observation = sensitiveParts.length > 0
    ? "Además de la explicación recibida, se observan señales que podrían ser útiles para una conversación personal y prudente. Esta lectura debe tomarse como una señal de cuidado, no como una conclusión definitiva."
    : "La información registrada debe revisarse pastoralmente sin asumir conclusiones no confirmadas.";
  const nextAction = followUpNeeded
    ? "Dar seguimiento durante la semana, escuchar cómo se encuentra y registrar el avance en una próxima bitácora."
    : "Conversar personalmente durante la semana o en la próxima reunión para confirmar cómo se encuentra y si necesita apoyo.";
  const structuredContent = `Motivo del contacto:
${contactReason}

Respuesta recibida:
${response}

Observación pastoral:
${observation}

Próxima acción sugerida:
${nextAction}`;

  return {
    success: true,
    structuredContent,
    suggestedCategory: inferCategoryFromText(rawText),
    summary: (sentenceParts[0] || normalized).replace(/^./, (c) => c.toUpperCase()),
    followUpNeeded,
    modelUsed: "fallback-structure",
  };
}

function buildSummaryPrompt(data: TeenData): string {
  return `Genera un resumen pastoral inteligente para el adolescente ${data.nombre} ${data.apellido}.
${PASTORAL_STYLE_GUIDE}

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "summary": "resumen ejecutivo de 2-3 párrafos en español, humano y prudente, cubriendo asistencia, señales pastorales, contactos y acompañamiento",
  "pastoralMomentum": "una frase que describa la tendencia general: 'Mejorando', 'Estable', 'Requiere atención' o 'En declive'",
  "mainChallenge": "principal señal de cuidado o desafío pastoral observado (una frase corta)",
  "recommendedFocus": "recomendación concreta para la próxima interacción pastoral"
}

Evita etiquetas frías. No diagnostiques. Si la información es limitada, dilo con prudencia.

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
      summary: typeof parsed.summary === "string" ? sanitizeHumanPastoralText(parsed.summary) : "",
      pastoralMomentum: typeof parsed.pastoralMomentum === "string" ? sanitizeHumanPastoralText(parsed.pastoralMomentum) : "",
      mainChallenge: typeof parsed.mainChallenge === "string" ? sanitizeHumanPastoralText(parsed.mainChallenge) : "",
      recommendedFocus: typeof parsed.recommendedFocus === "string" ? sanitizeHumanPastoralText(parsed.recommendedFocus) : "",
    };
  } catch {
    return null;
  }
}

export const generateTeenSummary = action({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
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
    await ctx.runMutation(internal.auditLog.logInternal, {
      token: args.token,
      action: "ai.summary.generated",
      entityType: "teen",
      entityId: args.teenId,
      newValue: { teenId: args.teenId, modelUsed },
      details: "Resumen pastoral IA generado.",
    });

    return { success: true, ...result, modelUsed };
  },
});

export const reviewAnalysis = mutation({
  args: {
    token: v.string(),
    analysisId: v.id("journalAnalysis"),
    notes: v.string(),
    status: v.optional(v.union(v.literal("reviewed"), v.literal("dismissed"), v.literal("escalated"))),
  },
  handler: async (ctx, args) => {
    const user = await getUserFromToken(ctx, args.token);
    if (!user) throw new Error("No autorizado");
    const analysis = await ctx.db.get(args.analysisId);
    if (!analysis) throw new Error("Análisis no encontrado.");
    const notes = args.notes.trim();
    if (!notes) throw new Error("Registra una nota de revisión.");
    const patch = {
      humanReviewRequired: false,
      reviewStatus: args.status ?? "reviewed",
      reviewedByUserId: user._id,
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes,
    };
    await ctx.db.patch(args.analysisId, patch);
    await logAudit(ctx, {
      token: args.token,
      action: "ai.analysis_reviewed",
      entityType: "journalAnalysis",
      entityId: String(args.analysisId),
      previousValue: analysis,
      newValue: { ...analysis, ...patch },
      details: notes,
    });
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
  return `Eres un asesor pastoral experto en acompañamiento juvenil. Analiza los datos del adolescente ${data.nombre} ${data.apellido} y estima señales de desconexión del ministerio.
${PASTORAL_STYLE_GUIDE}

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "probability": 0-100,
  "riskLevel": "low|medium|high",
  "primaryFactor": "señal principal observada (una frase corta, sin sentencia absoluta)",
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
riskLevel: "low" si probability < 30, "medium" si 30-69, "high" si >= 70.
La probabilidad es solo una señal de apoyo para revisión humana, no una sentencia sobre el adolescente.`;
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
      primaryFactor: typeof parsed.primaryFactor === "string" ? sanitizeHumanPastoralText(parsed.primaryFactor) : "",
      recommendation: typeof parsed.recommendation === "string" ? sanitizeHumanPastoralText(parsed.recommendation) : "",
    };
  } catch {
    return null;
  }
}

export const predictDropout = action({
  args: { teenId: v.id("teens"), token: v.optional(v.string()) },
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
    await ctx.runMutation(internal.auditLog.logInternal, {
      token: args.token,
      action: "ai.dropout.generated",
      entityType: "teen",
      entityId: args.teenId,
      newValue: { teenId: args.teenId, probability: result.probability, riskLevel: result.riskLevel, modelUsed },
      details: "Prediccion IA de abandono generada.",
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
  args: {
    token: v.optional(v.string()),
    activeScope: v.optional(v.object({
      campusId: v.optional(v.string()),
      ministryId: v.optional(v.string()),
      groupId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const access = await getEffectiveAccess(ctx, args.token);
    if (!access) throw new Error("No autenticado");

    const allTeens = await ctx.db.query("teens").collect();
    const teens = applyActiveScope(filterTeensByScope(access, allTeens), args.activeScope);
    const allowedTeenIds = new Set(teens.map((t) => t._id));
    const analyses = await ctx.db.query("journalAnalysis").order("desc").collect();
    const attendance = await ctx.db.query("attendance").collect();
    const journal = await ctx.db.query("journal").order("desc").collect();
    const contacts = await ctx.db.query("contacts").collect();
    const scopedAnalyses = analyses.filter((a) => allowedTeenIds.has(a.teenId));
    const scopedAttendance = attendance.filter((a) => allowedTeenIds.has(a.teenId));
    const scopedJournal = journal.filter((j) => allowedTeenIds.has(j.teenId));
    const scopedContacts = contacts.filter((c) => allowedTeenIds.has(c.teenId));
    const followUps = scopedJournal.filter((j) => j.followUp);

    const teenSummaries = teens.map((t) => {
      const teenAttendance = scopedAttendance.filter((a) => a.teenId === t._id);
      const total = teenAttendance.length;
      const present = teenAttendance.filter((a) => a.status === "present").length;
      const pct = total ? Math.round((present / total) * 100) : 0;
      const sorted = [...teenAttendance].sort((a, b) => b.date.localeCompare(a.date));
      let consecAbsences = 0;
      for (const r of sorted) { if (r.status === "absent") consecAbsences++; else break; }
      const teenAnalyses = scopedAnalyses.filter((a) => a.teenId === t._id);
      const crisisCount = teenAnalyses.filter((a) => a.isCrisis).length;
      const highRiskCount = teenAnalyses.filter((a) => a.riskLevel === "high").length;
      const tags = [...new Set(teenAnalyses.flatMap((a) => a.vulnerabilityTags))];
      const teenContacts = scopedContacts.filter((c) => c.teenId === t._id);
      const lastContacted = teenContacts.find((c) => c.status === "contacted");
      const journalCount = scopedJournal.filter((j) => j.teenId === t._id).length;
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
    for (const a of scopedAnalyses) {
      for (const tag of a.vulnerabilityTags || []) {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      }
    }

    return {
      teens: teenSummaries,
      totalTeens: teens.length,
      totalAnalyses: scopedAnalyses.length,
      totalCrisisAlerts: scopedAnalyses.filter((a) => a.isCrisis).length,
      totalFollowUps: followUps.length,
      overallAttendanceAvg: teenSummaries.length
        ? Math.round(teenSummaries.reduce((s, t) => s + t.attendancePct, 0) / teenSummaries.length)
        : 0,
      tagFrequency,
      highRiskCount: teenSummaries.filter((t) => t.riskLevel === "high").length,
      pendingContactCount: scopedContacts.filter((c) => c.status === "pending").length,
    };
  },
});

export const chatWithAI = action({
  args: {
    question: v.string(),
    token: v.optional(v.string()),
    activeScope: v.optional(v.object({
      campusId: v.optional(v.string()),
      ministryId: v.optional(v.string()),
      groupId: v.optional(v.string()),
    })),
    conversationHistory: v.optional(v.array(v.object({ role: v.string(), content: v.string() }))),
  },
  handler: async (ctx, args): Promise<{ success: boolean; answer?: string; modelUsed?: string; error?: string }> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const data: MinistryOverviewData = await ctx.runQuery(internal.ai.getMinistryOverviewData, {
      token: args.token,
      activeScope: args.activeScope,
    }) as any;

    // Buscar si la pregunta menciona a algún adolescente por su nombre
    let specificTeenContext = "";
    const questionLower = args.question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (data?.teens) {
      for (const t of data.teens) {
        const nombreNorm = t.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const apellidoNorm = t.apellido.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (
          (nombreNorm.length > 2 && questionLower.includes(nombreNorm)) ||
          (apellidoNorm.length > 2 && questionLower.includes(apellidoNorm))
        ) {
          const teenDetail = await ctx.runQuery(internal.ai.getTeenData, { teenId: t._id as any });
          if (teenDetail) {
            const journalsList = (teenDetail.recentJournals || [])
              .filter((j: any) => !j.isConfidential)
              .map((j: any) => `  * [${j.entryDate} - ${j.category}] (por ${j.leaderName}): "${j.content}"`)
              .join("\n");

            specificTeenContext += `\n--- DETALLE DE ADOLESCENTE CONSULTADO (${t.nombre} ${t.apellido}) ---
- ID de base de datos: ${teenDetail._id}
- Teléfono de contacto: ${teenDetail.telefono || "no registrado"}
- Asistencia: ${teenDetail.pct}% (${teenDetail.presentAttendance}/${teenDetail.totalAttendance} registros)
- Faltas consecutivas: ${teenDetail.consecAbsences}
- Nivel de Riesgo (Análisis IA): ${teenDetail.highRiskCount} de alto riesgo, ${teenDetail.crisisCount} alertas de crisis
- Vulnerabilidades principales: ${teenDetail.topTags.join(", ") || "ninguna"}
- Bitácoras escritas: ${teenDetail.journalCount}
- Contactos registrados: ${teenDetail.contactCount}
- Último contacto: ${teenDetail.lastContactDate || "nunca"}
- Intereses/Gustos: ${teenDetail.gustos || "no registrados"}
- Historial reciente de bitácoras (máx. 5 entradas):
${journalsList || "  * No hay bitácoras registradas para este adolescente."}
------------------------------------------------------\n`;
          }
        }
      }
    }

    if (!apiKey) {
      return {
        success: true,
        answer: buildFallbackPastoralResponse(data, args.question),
        modelUsed: "fallback-rules",
      };
    }

    const contextData = JSON.stringify({
      ministerio: "Adolescentes Cristo Vive",
      totalAdolescentes: data.totalTeens,
      asistenciaPromedio: `${data.overallAttendanceAvg}%`,
      alertasCrisis: data.totalCrisisAlerts,
      seguimientosPendientes: data.totalFollowUps,
      analisisIA: data.totalAnalyses,
      altoRiesgo: data.highRiskCount,
      contactosPendientes: data.pendingContactCount,
      adolescentes: data.teens.map((t: any) => ({
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

    const scopeLabel = args.activeScope?.groupId
      ? "grupo activo"
      : args.activeScope?.ministryId
      ? "ministerio activo"
      : args.activeScope?.campusId
      ? "sede activa"
      : "alcance completo autorizado";

    const systemPrompt = `Eres un asistente pastoral virtual para el ministerio de adolescentes "Cristo Vive".
${PASTORAL_STYLE_GUIDE}

Tienes acceso SOLO a datos reales y AUTORIZADOS del ministerio en formato JSON.
Responde unicamente basandote en los datos proporcionados y dentro del alcance permitido del usuario.
SIEMPRE responde en espanol, con un tono pastoral y profesional.
NO inventes datos que no esten en el JSON o en los detalles de adolescentes provistos. Si no sabes algo, dilo honestamente.
NO uses JSON en tu respuesta; responde en lenguaje natural usando viñetas si ayuda a la legibilidad.
NO reveles detalles tecnicos internos del modelo, proveedor, API, infraestructura o configuracion.
Si te preguntan por el modelo o proveedor, redirige con amabilidad a tu funcion pastoral y ofrece ayuda con informacion del ministerio.
NO compartas informacion de otras sedes, ministerios, grupos o personas fuera del alcance autorizado.
Si una pregunta pide datos fuera del alcance, responde que solo puedes ayudar con la informacion autorizada del ministerio dentro de su alcance actual.
Puedes hacer calculos simples con los datos (contar, sumar, promediar).
Separa datos observados de sugerencias pastorales cuando respondas sobre un adolescente o caso sensible.
Incluye "requiere revisión humana" si mencionas riesgo, crisis o señales sensibles.

INSTRUCCIONES DE COMANDOS INTERACTIVOS (NIVEL 2):
1. Si el usuario te pide ver, abrir, mostrar, ir al perfil o ficha de un adolescente específico, debes incluir exactamente este comando en una sola línea al final de tu respuesta:
   [COMMAND: open_profile(ID_DEL_ADOLESCENTE)]
   Reemplaza ID_DEL_ADOLESCENTE con el ID de base de datos que se te proporciona en el detalle del adolescente.
2. Si el usuario te pide ir a ver, abrir, navegar o cambiar a una pestaña o sección del sistema (dashboard, asistencia, jovenes, campana, ia, reportes, ajustes, accesos), debes incluir exactamente este comando en una sola línea al final de tu respuesta:
   [COMMAND: switch_tab(tabId)]
   Donde tabId es uno de estos: dashboard, asistencia, jovenes, campana, ia, reportes, ajustes, accesos.

INSTRUCCIÓN DE SUGERENCIA DE WHATSAPP:
3. Si el usuario te pregunta por el estado de un adolescente, te pide redactar un mensaje para él, o expresa interés en contactarlo, debes incluir una sugerencia de mensaje cálido y personalizado de 2-3 oraciones al final de tu respuesta en este formato exacto en una sola línea:
   [WHATSAPP_SUGGESTION: teléfono | mensaje_redactado]
   Reemplaza 'teléfono' con el número de teléfono del adolescente provisto en su detalle (con formato de dígitos, Ej: 8095550101). Reemplaza 'mensaje_redactado' con un mensaje cercano, pastoral y personalizado utilizando sus intereses/gustos y su situación pastoral (asistencia, racha, etc.).

Alcance actual del usuario: ${scopeLabel}.
Datos autorizados del ministerio:
${contextData}
${specificTeenContext ? `\nInformación detallada sobre adolescentes consultados:\n${specificTeenContext}` : ""}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(args.conversationHistory || []).slice(-10),
      { role: "user", content: args.question },
    ];

    for (const model of FREE_MODELS) {
      const raw = await callModelRaw(apiKey, model, messages, 1000);
      if (raw) {
        const answer = sanitizeHumanPastoralText(raw);
        await ctx.runMutation(internal.auditLog.logInternal, {
          token: args.token,
          action: "ai.chat.generated",
          entityType: "aiChat",
          details: "Respuesta de IA pastoral generada.",
          newValue: { modelUsed: model },
        });
        return { success: true, answer, modelUsed: model };
      }
    }
    return {
      success: true,
      answer: buildFallbackPastoralResponse(data, args.question),
      modelUsed: "fallback-rules",
    };
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
    return sanitizeModelText(data?.choices?.[0]?.message?.content || null);
  } catch {
    return null;
  }
}

export const generateActivityRecommendations = action({
  args: {
    token: v.optional(v.string()),
    activeScope: v.optional(v.object({
      campusId: v.optional(v.string()),
      ministryId: v.optional(v.string()),
      groupId: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { success: false, error: "No API key configured" };

    const data = await ctx.runQuery(internal.ai.getMinistryOverviewData, {
      token: args.token,
      activeScope: args.activeScope,
    });

    const prompt = `Eres un asesor de ministerio juvenil. Basado en los datos de señales pastorales, vulnerabilidades y riesgo del ministerio, genera recomendaciones de actividades, talleres y estudios bíblicos.
${PASTORAL_STYLE_GUIDE}

Responde ÚNICAMENTE con JSON válido en este formato:
{
  "recommendations": [
    {
      "title": "título de la actividad",
      "type": "taller | estudio | actividad | campaña",
      "description": "descripción humana, práctica y pastoral de 2-3 oraciones",
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
  .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
  .map(([tag, count]) => `- ${tag}: ${count}`)
  .join("\n")}`;

    for (const model of FREE_MODELS) {
      const raw = await callModel(apiKey, model, prompt);
      if (!raw) continue;
      try {
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.recommendations)) {
          return {
            success: true,
            recommendations: parsed.recommendations.map((recommendation: any) => ({
              ...recommendation,
              title: typeof recommendation.title === "string" ? sanitizeHumanPastoralText(recommendation.title) : "",
              description: typeof recommendation.description === "string" ? sanitizeHumanPastoralText(recommendation.description) : "",
            })),
            modelUsed: model,
          };
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
${PASTORAL_STYLE_GUIDE}

Responde ÚNICAMENTE con el texto del mensaje en español, sin JSON, sin formato adicional. Usa un tono natural y cercano, como de un líder juvenil.
El mensaje debe sonar humano, breve y no invasivo. No menciones vulnerabilidades, riesgo ni alertas de crisis de forma directa.
Si hay ausencias, invita y acompaña sin culpar. Si hay crisis, usa un tono cuidadoso y anima a conversar con un líder responsable.

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
        message = sanitizeHumanPastoralText(sanitizeModelText(raw.replace(/```\s*/g, "").trim()) || "");
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
    if (!apiKey) return structureTranscriptionFallback(args.rawText);

    const prompt = `Eres un asistente pastoral para una bitácora de acompañamiento juvenil.
${PASTORAL_STYLE_GUIDE}

Tu tarea es resumir, humanizar y estructurar el texto original sin inventar hechos, diagnósticos ni conclusiones absolutas.
Corrige muletillas, repeticiones, errores leves de dictado y expresiones poco claras.
Separa hechos, respuesta recibida, observación pastoral prudente y próxima acción.
Usa tono humano, claro, pastoral y sobrio. Evita lenguaje alarmista.
Si un dato no aparece en el texto, escribe "No se especifica" en lugar de inventarlo.
No copies el texto original literalmente. Resume y redacta de nuevo con claridad pastoral.
No uses guiones duplicados ni listas extensas; prefiere párrafos breves.
Responde ÚNICAMENTE con JSON válido en este formato:
{
  "structuredContent": "${JOURNAL_STRUCTURE_TEMPLATE.replace(/\n/g, "\\n")}",
  "suggestedCategory": "call | visit | chat | counseling | prayer | other",
  "summary": "resumen de 1 oración",
  "followUpNeeded": true | false
}

Formato obligatorio para structuredContent:
Motivo del contacto:
Explica en 1 o 2 frases por qué se registró este contacto o acompañamiento.

Respuesta recibida:
Resume de forma humanizada lo que la persona comunicó. Usa viñetas solo si hay varios puntos.

Observación pastoral:
Redacta una lectura prudente basada solo en los datos. No diagnostiques. No afirmes intenciones no expresadas.

Próxima acción sugerida:
Propón una acción concreta, breve y pastoralmente responsable.

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
          structuredContent: typeof parsed.structuredContent === "string" ? sanitizeHumanPastoralText(sanitizeModelText(parsed.structuredContent) || args.rawText) : args.rawText,
          suggestedCategory: ["call", "visit", "chat", "counseling", "prayer", "other"].includes(parsed.suggestedCategory) ? parsed.suggestedCategory : inferCategoryFromText(args.rawText),
          summary: typeof parsed.summary === "string" ? sanitizeHumanPastoralText(parsed.summary) : "",
          followUpNeeded: parsed.followUpNeeded === true,
          modelUsed: model,
        };
      } catch {
        continue;
      }
    }
    return structureTranscriptionFallback(args.rawText);
  },
});

export const storeWeeklySummary = mutation({
  args: {
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
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("weeklySummaries", {
      ...args,
      generatedAt: new Date().toISOString(),
    });
  },
});

export const getLatestWeeklySummary = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("weeklySummaries")
      .order("desc")
      .first();
  },
});

export const storeActivityRecommendations = mutation({
  args: {
    recommendations: v.array(v.object({
      title: v.string(),
      type: v.string(),
      description: v.string(),
      bibleVerse: v.optional(v.string()),
      targetTags: v.optional(v.array(v.string())),
      urgency: v.string(),
    })),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const oldPending = await ctx.db
      .query("activityRecommendations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    for (const r of oldPending) {
      await ctx.db.delete(r._id);
    }

    const ids = [];
    const generatedAt = new Date().toISOString();
    for (const rec of args.recommendations) {
      const id = await ctx.db.insert("activityRecommendations", {
        ...rec,
        status: "pending",
        generatedAt,
        modelUsed: args.modelUsed,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const updateRecommendationStatus = mutation({
  args: {
    id: v.id("activityRecommendations"),
    status: v.union(v.literal("pending"), v.literal("implemented"), v.literal("dismissed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const getActivityRecommendations = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("activityRecommendations")
      .order("desc")
      .collect();
  },
});
