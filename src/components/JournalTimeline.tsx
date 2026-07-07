import { useState, FormEvent, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { JournalAnalysis } from "../lib/types";
import { VULNERABILITY_TAGS } from "../lib/types";
import { fmtDate, esc } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import Modal from "./Modal";

interface JournalProps {
  teenId: string;
}

const categoryMeta: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  call: { label: "Llamada", icon: "📞", color: "bg-teal-50 border-teal-100" },
  visit: { label: "Visita", icon: "🏠", color: "bg-sage-50 border-sage-100" },
  chat: { label: "WhatsApp", icon: "📱", color: "bg-green-50 border-green-100" },
  counseling: { label: "Consejería", icon: "💬", color: "bg-amber-50 border-amber-100" },
  prayer: { label: "Oración", icon: "🙏", color: "bg-coral-50 border-coral-100" },
  other: { label: "Nota", icon: "📝", color: "bg-ink/5 border-ink/10" },
};

const riskColors: Record<string, string> = {
  low: "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

const confidenceLabel: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const sourceLabel: Record<string, string> = {
  journal: "Bitácora",
  attendance: "Asistencia",
  teen_profile: "Ficha",
  pastoral_plan: "Plan pastoral",
  pastoral_tasks: "Tareas",
  previous_ai_analysis: "IA previa",
};

const reviewStatusLabel: Record<string, string> = {
  pending: "Revisión pendiente",
  reviewed: "Revisado",
  dismissed: "Desestimado",
  escalated: "Escalado",
};

export default function JournalTimeline({ teenId }: JournalProps) {
  const { user, token } = useAuth();
  const entries = useQuery(api.journal.list, { teenId: teenId as any, token: token ?? undefined });
  const createEntry = useMutation(api.journal.create);
  const deleteEntry = useMutation(api.journal.remove);
  const analyzeEntry = useAction(api.ai.analyzeJournalEntry as any);
  const reviewAnalysis = useMutation(api.ai.reviewAnalysis);
  const allAnalyses = useQuery(api.ai.getAllAnalyses);
  const recordJournalView = useMutation(api.auditLog.recordJournalView);

  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("other");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaderName, setLeaderName] = useState(user?.name || "");
  const [followUp, setFollowUp] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<{ analysisId: string; notes: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const structureAction = useAction(api.ai.structureTranscription as any);
  const recognitionRef = useRef<any>(null);
  const listeningTimeoutRef = useRef<number | null>(null);
  const viewedAuditRef = useRef(false);

  const clearListeningState = () => {
    setListening(false);
    if (listeningTimeoutRef.current) {
      window.clearTimeout(listeningTimeoutRef.current);
      listeningTimeoutRef.current = null;
    }
    recognitionRef.current = null;
  };

  useEffect(() => {
    const viewedConfidential = entries?.some((entry) => entry.isConfidential);
    if (token && viewedConfidential && !viewedAuditRef.current) {
      viewedAuditRef.current = true;
      recordJournalView({ token, teenId: teenId as any });
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore cleanup failures
        }
      }
      if (listeningTimeoutRef.current) {
        window.clearTimeout(listeningTimeoutRef.current);
      }
    };
  }, [entries, recordJournalView, teenId, token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !leaderName.trim()) return;
    const entryId = await createEntry({
      teenId: teenId as any,
      entryDate,
      content: content.trim(),
      category: category as any,
      leaderName: leaderName.trim(),
      followUp,
      isConfidential,
      token: token ?? undefined,
    });
    if (entryId) {
      analyzeEntry({
        entryId,
        teenId: teenId as any,
        content: content.trim(),
        category,
        token: token ?? undefined,
      });
    }
    setContent("");
    setLeaderName("");
    setFollowUp(false);
    setIsConfidential(false);
    setShowForm(false);
  };

  return (
    <div className="bg-card rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-semibold text-base">
          Bitácora de acompañamiento
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-semibold bg-ink text-white rounded-full px-3.5 py-2 flex items-center gap-1.5"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {showForm ? "Cerrar" : "Nueva entrada"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 p-4 rounded-xl border border-ink/10 bg-ink/[0.02] space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Fecha
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
              >
                <option value="call">📞 Llamada</option>
                <option value="visit">🏠 Visita</option>
                <option value="chat">📱 WhatsApp</option>
                <option value="counseling">💬 Consejería</option>
                <option value="prayer">🙏 Oración</option>
                <option value="other">📝 Nota</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">
              Líder a cargo
            </label>
            <input
              type="text"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              placeholder="Nombre del líder"
              required
              className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">
              Contenido
            </label>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Describe la llamada, visita o conversación..."
                required
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-base resize-none pr-10"
              />
              <button
                type="button"
                onClick={() => {
                  if (listening && recognitionRef.current) {
                    try {
                      recognitionRef.current.stop();
                    } catch {
                      clearListeningState();
                    }
                    return;
                  }
                  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                  if (!SpeechRecognition) {
                    alert("La transcripción por voz no está disponible en este navegador. Usa Chrome o Edge.");
                    return;
                  }
                  const recognition = new SpeechRecognition();
                  recognitionRef.current = recognition;
                  recognition.lang = "es-MX";
                  recognition.interimResults = false;
                  recognition.continuous = false;
                  recognition.maxAlternatives = 1;
                  recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    setContent((prev) => prev + (prev ? " " : "") + transcript);
                    clearListeningState();
                  };
                  recognition.onerror = () => clearListeningState();
                  recognition.onnomatch = () => clearListeningState();
                  recognition.onend = () => clearListeningState();
                  setListening(true);
                  listeningTimeoutRef.current = window.setTimeout(() => {
                    if (recognitionRef.current) {
                      try {
                        recognitionRef.current.stop();
                      } catch {
                        clearListeningState();
                      }
                    }
                  }, 12000);
                  recognition.start();
                }}
                className={`absolute right-2 bottom-2.5 w-7 h-7 rounded-lg flex items-center justify-center transition ${
                  listening ? "bg-red-100 text-red-600 animate-pulse" : "bg-ink/5 text-ink/40 hover:text-ink hover:bg-ink/10"
                }`}
                title={listening ? "Detener grabación" : "Transcribir por voz"}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <path d="M12 19v3" />
                </svg>
              </button>
            </div>
            {content.trim() && (
              <button
                type="button"
                onClick={async () => {
                  if (structuring) return;
                  setStructuring(true);
                  const result = await structureAction({ rawText: content }) as any;
                  if (result.success) {
                    setContent(result.structuredContent);
                    if (result.suggestedCategory) setCategory(result.suggestedCategory);
                    if (result.followUpNeeded) setFollowUp(true);
                  }
                  setStructuring(false);
                }}
                disabled={structuring}
                className="mt-2 text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-full transition disabled:opacity-50"
              >
                {structuring ? "Estructurando..." : "✨ Estructurar con IA"}
              </button>
            )}
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="w-4 h-4 rounded border-ink/20 text-coral-600 focus:ring-coral-500"
            />
            <span className="text-sm text-ink/70">
              <span className="font-semibold">Marcar como seguimiento histórico</span>
              <span className="text-xs text-ink/40 ml-1">
                — para pendientes usa Tareas pastorales
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="w-4 h-4 rounded border-ink/20 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-ink/70">
              <span className="font-semibold">Entrada confidencial</span>
              <span className="text-xs text-ink/40 ml-1">
                — solo visible para directores, coordinadores y pastores
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="w-full bg-ink text-white rounded-xl py-2.5 text-sm font-semibold"
          >
            Guardar entrada
          </button>
        </form>
      )}

      {entries === undefined ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-ink/5 rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto rounded-full bg-ink/5 flex items-center justify-center mb-3 text-ink/30">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink/70">
            Sin registros
          </p>
          <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">
            Agrega la primera entrada para llevar un historial de
            acompañamiento pastoral.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-ink/10" />
          <div className="space-y-4">
            {entries.map((entry) => {
              const meta = categoryMeta[entry.category] || categoryMeta.other;
              const analysis: JournalAnalysis | undefined = allAnalyses?.find((a: any) => a.entryId === entry._id) as any;
              return (
                <div key={entry._id} className="relative pl-10">
                  <div
                    className={`absolute left-[9px] w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center text-[10px] ${meta.color}`}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-ink/50">
                          {fmtDate(entry.entryDate)}
                        </span>
                        <span className="text-[10px] font-medium text-ink/30 px-1.5 py-0.5 rounded-full bg-ink/5">
                          {meta.label}
                        </span>
                        {entry.followUp && (
                          <span className="text-[10px] font-semibold text-coral-600 bg-coral-50 px-1.5 py-0.5 rounded-full">
                            📌 Seguimiento
                          </span>
                        )}
                        {entry.isConfidential && (
                          <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-full">
                            🔒 Confidencial
                          </span>
                        )}
                        {analysis && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${riskColors[analysis.riskLevel] || ""}`}>
                            {analysis.riskLevel === "high" ? "🔴" : analysis.riskLevel === "medium" ? "🟡" : "🟢"} Sugerido {analysis.riskLevel === "high" ? "Alto" : analysis.riskLevel === "medium" ? "Medio" : "Bajo"}
                          </span>
                        )}
                        {analysis?.humanReviewRequired !== false && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full">
                            Requiere revisión humana
                          </span>
                        )}
                        {analysis?.isCrisis && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
                            🚨 Crisis
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink/40 font-medium">
                        por {esc(entry.leaderName || "Anónimo")}
                      </p>
                      <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                        {esc(entry.content)}
                      </p>
                      {analysis && analysis.vulnerabilityTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {analysis.vulnerabilityTags.map((tag) => {
                            const tagMeta = VULNERABILITY_TAGS.find((t) => t.id === tag);
                            return (
                              <span key={tag} className="text-[10px] font-medium bg-ink/5 text-ink/50 px-1.5 py-0.5 rounded-full">
                                {tagMeta ? `${tagMeta.icon} ${tagMeta.label}` : tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {analysis && (
                        <div className="mt-2 rounded-xl border border-purple-100 bg-purple-50/70 p-3 text-xs text-purple-900 space-y-1">
                          <p className="font-semibold">IA pastoral: sugerencia, no diagnóstico</p>
                          <p><span className="font-semibold">Confianza:</span> {confidenceLabel[analysis.confidence || "low"]}</p>
                          <p><span className="font-semibold">Estado revisión:</span> {reviewStatusLabel[analysis.reviewStatus || (analysis.humanReviewRequired === false ? "reviewed" : "pending")]}</p>
                          {analysis.reasoningSummary && (
                            <p><span className="font-semibold">Motivo:</span> {esc(analysis.reasoningSummary)}</p>
                          )}
                          {analysis.suggestedActions?.length > 0 && (
                            <p><span className="font-semibold">Acción recomendada:</span> {esc(analysis.suggestedActions[0])}</p>
                          )}
                          {analysis.usedDataSources && analysis.usedDataSources.length > 0 && (
                            <p><span className="font-semibold">Datos usados:</span> {analysis.usedDataSources.map((s) => sourceLabel[s] || s).join(", ")}</p>
                          )}
                          <p className="text-purple-800/80">{analysis.pastoralDisclaimer || "Esta sugerencia requiere revisión humana pastoral."}</p>
                          {analysis.humanReviewRequired !== false && token && (
                            <button
                              type="button"
                              onClick={() => setReviewDraft({ analysisId: String((analysis as any)._id), notes: "" })}
                              className="mt-2 rounded-lg bg-purple-700 px-3 py-1.5 text-[11px] font-semibold text-white"
                            >
                              Marcar revisado
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteEntry({ id: entry._id, token: token ?? undefined })}
                      className="shrink-0 w-8 h-8 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-coral-600 hover:bg-coral-50 transition mt-1"
                      title="Eliminar"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviewDraft && (
        <Modal title="Revisión humana de IA" onClose={() => setReviewDraft(null)}>
          <div className="p-5 space-y-4">
            <p className="text-sm text-ink/60">
              Registra la nota de revisión para dejar constancia de que la sugerencia fue evaluada por una persona.
            </p>
            <textarea
              value={reviewDraft.notes}
              onChange={(event) => setReviewDraft({ ...reviewDraft, notes: event.target.value })}
              rows={4}
              autoFocus
              placeholder="Nota de revisión humana..."
              className="w-full resize-none rounded-xl border border-ink/10 bg-card px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setReviewDraft(null)} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 hover:bg-ink/5 transition">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!token || !reviewDraft.notes.trim()) return;
                  await reviewAnalysis({ token, analysisId: reviewDraft.analysisId as any, notes: reviewDraft.notes.trim(), status: "reviewed" });
                  setReviewDraft(null);
                }}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition pressable"
              >
                Guardar revisión
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
