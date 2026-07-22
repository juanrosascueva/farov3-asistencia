import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, RiskInfo, TeenSummary } from "../lib/types";
import { VULNERABILITY_TAGS } from "../lib/types";
import {
  statsFor,
  riskScore,
  ageFromDOB,
  fmtDate,
  esc,
  getGamification,
  getTeenContactWarnings,
  getTeenStatus,
  teenProfileCompleteness,
  TEEN_STATUS_META,
  SPIRITUAL_STAGE_LABELS,
} from "../lib/utils";
import { fill } from "../lib/templates";
import { useTemplates } from "../hooks/useTemplates";
import WhatsAppModal from "./WhatsAppModal";
import JournalTimeline from "./JournalTimeline";
import PastoralPlanCard from "./PastoralPlanCard";
import PastoralTasksCard from "./PastoralTasksCard";
import TransitionsCard from "./TransitionsCard";
import BadgeGrid from "./BadgeGrid";
import XpBar from "./XpBar";
import { Avatar } from "./Layout";
import TeenForm from "./TeenForm";
import Modal from "./Modal";
import ResponsiveSheet from "./ResponsiveSheet";
import { useAuth } from "../hooks/useAuth";

function sanitizeAiText(text: string): string {
  return text
    .replace(/<\/?pad>/gi, "")
    .replace(/<pad>/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ProfileProps {
  teen: Doc<"teens">;
  attendanceMap: AttendanceMap;
  onBack: () => void;
  onDeleted: () => void;
}

export default function Profile({
  teen,
  attendanceMap,
  onBack,
  onDeleted,
}: ProfileProps) {
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showQuickWA, setShowQuickWA] = useState(false);
  const { token } = useAuth();
  const deleteTeen = useMutation(api.teens.remove);

  const teenSummary = useQuery(api.ai.getTeenSummary, { teenId: teen._id as any });
  const generateSummary = useAction(api.ai.generateTeenSummary as any);
  const analyses = useQuery(api.ai.getAnalysisByTeen, { teenId: teen._id as any }) ?? [];
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const dropoutPred = useQuery(api.ai.getDropoutPrediction, { teenId: teen._id as any });
  const predictDropout = useAction(api.ai.predictDropout as any);
  const generateMsg = useAction(api.ai.generatePersonalizedMessage as any);
  const [generatingDropout, setGeneratingDropout] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [showAIMsg, setShowAIMsg] = useState(false);
  const [aiMsg, setAiMsg] = useState("");
  const [aiMsgTone, setAiMsgTone] = useState<string>("aliento");
  const [aiMsgTarget, setAiMsgTarget] = useState<"teen" | "parent">("teen");

  const crisisAnalyses = (analyses as any[]).filter((a: any) => a.isCrisis);
  const hasCrisis = crisisAnalyses.length > 0;

  const s = statsFor(teen._id, attendanceMap);
  const risk = riskScore(s);
  const age = ageFromDOB(teen.nacimiento);
  const status = getTeenStatus(teen);
  const completeness = teenProfileCompleteness(teen);
  const warnings = getTeenContactWarnings(teen);
  const history = [...s.history].reverse().slice(0, 12);
  const game = getGamification(s);
  const { templates } = useTemplates();
  const vars = {
    nombre: teen.nombre,
    apellido: teen.apellido,
    racha: s.presentStreak,
    faltas: s.consecutiveAbsences,
    telefonoPadre: teen.telefonoPadre || "",
  };
  const alertTemplates = templates
    .filter((t) => t.category === "absence")
    .map((t) => ({ ...t, text: fill(t.text, vars) }));
  const allTemplates = templates.map((t) => ({ ...t, text: fill(t.text, vars) }));

  const handleDelete = async () => {
    await deleteTeen({ id: teen._id, token: token ?? undefined });
    onDeleted();
  };

  const familyRecords = useQuery(api.guardians.listByTeen, token ? { teenId: teen._id as any, token } : "skip");
  const personRecord = useQuery(api.people.getByTeen, token ? { teenId: teen._id as any, token } : "skip");
  const leaderAssignments = useQuery(api.teens.listLeaderAssignments, token ? { token } : "skip") ?? [];
  const leaderAssignment = leaderAssignments.find((item: any) => String(item.teenId) === String(teen._id));

  const statusMap: Record<string, { label: string; cls: string }> = {
    present: { label: "Presente", cls: "bg-sage-50 text-sage-600" },
    absent: { label: "Ausente", cls: "bg-coral-50 text-coral-600" },
    excused: { label: "Justificado", cls: "bg-amber-50 text-amber-600" },
  };

  const riskColorMap: Record<string, string> = {
    gray: "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-950/30 dark:border-slate-800/60 dark:text-slate-400",
    teal: "bg-teal-50 border-teal-100 text-teal-700 dark:bg-teal-950/30 dark:border-teal-900/40 dark:text-teal-400",
    amber: "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400",
    coral: "bg-coral-50 border-coral-100 text-coral-700 dark:bg-orange-950/30 dark:border-orange-900/40 dark:text-orange-400",
    red: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400",
  };
  const consentLabel: Record<string, string> = {
    data: "Datos personales",
    photo: "Uso de fotografía",
  };
  const consentStatus: Record<string, string> = {
    granted: "Otorgado",
    pending: "Pendiente",
    declined: "Rechazado",
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-ink/50 hover:text-ink"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Volver
      </button>

      <div className="bg-card rounded-card shadow-soft p-5">
        <div className="flex items-start gap-4">
          <Avatar teen={teen} size="lg" />
          <div className="flex-1 min-w-0">
             <h1 className="font-display text-xl font-bold">
               {esc(teen.nombre)} {esc(teen.apellido)}
             </h1>
             <p className="text-sm text-ink/45">
              {age !== null
                ? age + " años"
                : "Fecha de nacimiento no registrada"}
              {teen.nacimiento ? " · " + fmtDate(teen.nacimiento) : ""}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${TEEN_STATUS_META[status].cls}`}>
                {TEEN_STATUS_META[status].label}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-ink/[0.03] text-ink/60 border-ink/10">
                Ficha {completeness.percent}%
              </span>
              {((teen as any).fichaCompleta === false || (teen as any).registroRapido) && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-100">
                  Ficha incompleta
                </span>
              )}
              {teen.requiereSeguimientoEspecial && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-100">
                  Seguimiento especial
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={() => setShowEdit(true)}
                className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 rounded-full px-3 py-1.5 flex items-center gap-1.5"
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
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
                Editar
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="text-xs font-semibold bg-coral-50 text-coral-600 hover:bg-coral-100 rounded-full px-3 py-1.5 flex items-center gap-1.5"
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
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>

        <div
          className={`mt-4 p-3.5 rounded-xl border ${riskColorMap[risk.color]} ${risk.score === 0 ? "opacity-50" : ""}`}
        >
          <div className="flex items-start gap-3">
            <div className="relative shrink-0 w-12 h-12 flex items-center justify-center">
              <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  className="stroke-ink/5 dark:stroke-white/5"
                  strokeWidth="3.5"
                  fill="transparent"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  className="transition-all duration-500 ease-out"
                  strokeWidth="3.5"
                  strokeDasharray="113.1"
                  strokeDashoffset={113.1 - (risk.score / 5) * 113.1}
                  strokeLinecap="round"
                  stroke={({ gray: "#6B7280", teal: "#0B7285", amber: "#F0A33C", coral: "#E8590C", red: "#DC2626" } as Record<string, string>)[risk.color]}
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-sm font-extrabold text-ink">
                {risk.score}
              </span>
            </div>
            <div className="text-sm flex-1 min-w-0">
              <p className="font-semibold">
                Score de riesgo: {risk.score} — {risk.label}
              </p>
              <p className="text-xs opacity-80 mt-0.5">{risk.action}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-[11px]">
                <span>Faltas consecutivas: <strong>{risk.factors.consecutiveAbsences}</strong></span>
                <span>Asistencia: <strong>{s.pct}%</strong></span>
              </div>
            </div>
            {risk.score >= 1 && (teen.telefonoPadre || teen.telefono) && (
              <button
                onClick={() => setShowWhatsApp(true)}
                className="shrink-0 w-10 h-10 rounded-full bg-white/70 flex items-center justify-center hover:bg-white/90 transition"
              >
                <WhatsAppIcon />
              </button>
            )}
          </div>
        </div>
      </div>

      {hasCrisis && (
        <div className="bg-red-50 border border-red-200 rounded-card p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0 text-lg">🚨</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">Alerta de crisis detectada</p>
            <p className="text-xs text-red-600/80 mt-0.5">
              {crisisAnalyses.length} bitácora{crisisAnalyses.length > 1 ? "s" : ""} con indicios de crisis. Revisa las sugerencias de IA y toma acción inmediata.
            </p>
          </div>
        </div>
      )}

      {!dropoutPred && (
        <div className="bg-card border border-ink/10 rounded-card p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink/5 flex items-center justify-center text-ink/30">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink/70">Predicción de abandono</p>
              <p className="text-xs text-ink/40">Analiza el riesgo con IA</p>
            </div>
          </div>
          <button
            onClick={async () => { setGeneratingDropout(true); await predictDropout({ teenId: teen._id as any, token: token ?? undefined }); setGeneratingDropout(false); }}
            disabled={generatingDropout}
            className="text-xs font-semibold bg-ink/5 hover:bg-ink/10 rounded-full px-3 py-1.5 disabled:opacity-50"
          >
            {generatingDropout ? "Analizando..." : "Predecir"}
          </button>
        </div>
      )}

      {dropoutPred && (
        <div className={`rounded-card p-4 border flex items-start gap-3 ${
          dropoutPred.riskLevel === "high" ? "bg-red-50 border-red-200" : dropoutPred.riskLevel === "medium" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0 ${
            dropoutPred.riskLevel === "high" ? "bg-red-500" : dropoutPred.riskLevel === "medium" ? "bg-amber-500" : "bg-green-500"
          }`}>
            {dropoutPred.probability}%
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">{dropoutPred.riskLevel === "high" ? "Alto riesgo de abandono" : dropoutPred.riskLevel === "medium" ? "Riesgo de abandono moderado" : "Bajo riesgo de abandono"}</p>
            <p className="text-xs mt-0.5 opacity-80">Factor principal: {dropoutPred.primaryFactor}</p>
            <p className="text-xs mt-1 italic opacity-70">{dropoutPred.recommendation}</p>
            <button
              onClick={async () => { setGeneratingDropout(true); await predictDropout({ teenId: teen._id as any, token: token ?? undefined }); setGeneratingDropout(false); }}
              disabled={generatingDropout}
              className="text-[11px] font-semibold mt-2 underline underline-offset-2 opacity-60 hover:opacity-100 disabled:opacity-30"
            >
              {generatingDropout ? "Actualizando..." : "Actualizar predicción"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCardInline label="Asistencia" value={s.pct + "%"} icon="check" color="teal" />
        <StatCardInline
          label="Racha actual"
          value={s.presentStreak ? `${game.streakTier?.icon ?? ""}${s.presentStreak}` : "0"}
          icon="flame"
          color="amber"
        />
        <StatCardInline label="Total registrado" value={s.total} icon="users" color="ink" />
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-card p-4">
          <p className="text-sm font-semibold text-amber-800">Alertas de ficha</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {warnings.map((warning) => (
              <span key={warning} className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-100">
                {warning}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
        <h2 className="font-display font-semibold text-base">Ficha pastoral</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="Tutor principal" value={teen.nombreEncargado} />
          <InfoRow label="Parentesco" value={teen.parentescoEncargado} />
          <InfoRow
            label="Inscripción Teens"
            value={personRecord?.enrollments?.some((enrollment: any) => enrollment.status === "active") ? "Activa" : "Pendiente"}
          />
          <InfoRow label="Fecha de ingreso" value={teen.fechaIngreso ? fmtDate(teen.fechaIngreso) : ""} />
          <InfoRow label="Momento espiritual" value={teen.decisionEspiritual ? SPIRITUAL_STAGE_LABELS[teen.decisionEspiritual] : ""} />
          <InfoRow label="Colegio" value={teen.colegio} />
          <InfoRow label="Grado escolar" value={teen.gradoEscolar} />
          <InfoRow label="Barrio / zona" value={teen.barrio} />
          <InfoRow label="Vive con" value={teen.viveCon} />
        </div>
        {teen.observacionInicial && (
          <div>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">Observación inicial</p>
            <p className="text-sm whitespace-pre-line break-words overflow-wrap-anywhere">{esc(teen.observacionInicial)}</p>
          </div>
        )}
        {teen.motivoInactividad && (
          <div>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">Motivo del estado actual</p>
            <p className="text-sm whitespace-pre-line break-words overflow-wrap-anywhere">{esc(teen.motivoInactividad)}</p>
          </div>
        )}
      </div>

      <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
        <h2 className="font-display font-semibold text-base">
          Guardianes y consentimientos
        </h2>
        <p className="text-xs text-ink/50"><span className="font-semibold text-ink/65">Líder responsable:</span> {leaderAssignment?.userName || "Sin responsable"} <span className="text-ink/35">· {leaderAssignment?.source === "individual" ? "Asignación individual" : leaderAssignment?.source === "group" ? "Líder del grupo" : "Sin responsable"}</span></p>
        {familyRecords?.guardians?.length ? (
          <div className="grid gap-2">
            {familyRecords.guardians.map((guardian: any) => (
              <div key={guardian._id} className="rounded-xl border border-ink/10 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{esc(guardian.name)}</p>
                  {guardian.isPrimary && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                      Principal
                    </span>
                  )}
                </div>
                <div className="mt-2 grid sm:grid-cols-2 gap-2 text-xs text-ink/60">
                  <span>{esc(guardian.relationship || "Sin parentesco")}</span>
                  <span>{esc(guardian.phone || "Sin teléfono principal")}</span>
                  {guardian.emergencyName && <span>Emergencia: {esc(guardian.emergencyName)}</span>}
                  {guardian.emergencyPhone && <span>{esc(guardian.emergencyPhone)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink/40">Sin guardianes formales registrados.</p>
        )}
        <div className="grid sm:grid-cols-2 gap-2">
          {(familyRecords?.consents || []).map((consent: any) => (
            <div key={consent._id} className="rounded-xl border border-ink/10 p-3 text-sm">
              <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">{consentLabel[consent.type] || consent.type}</p>
              <p className="font-semibold text-ink mt-1">{consentStatus[consent.status] || consent.status}</p>
              {consent.grantedAt && <p className="text-xs text-ink/45 mt-1">{fmtDate(consent.grantedAt)}</p>}
              {consent.guardianName && <p className="text-xs text-ink/45 mt-1">Por {esc(consent.guardianName)}</p>}
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="Teléfono del adolescente" value={teen.telefono} />
          <InfoRow label="Teléfono del encargado" value={teen.telefonoPadre} />
          <InfoRow label="Teléfono secundario" value={teen.telefonoSecundario} />
          <InfoRow label="Contacto de emergencia" value={teen.contactoEmergenciaNombre} />
          <InfoRow label="Teléfono de emergencia" value={teen.contactoEmergenciaTelefono} />
          <InfoRow label="Consentimiento de datos" value={teen.consentimientoDatos ? "Sí" : "Pendiente"} />
          <InfoRow label="Consentimiento de foto" value={teen.consentimientoFoto ? "Sí" : "Pendiente"} />
          <InfoRow label="Fecha de consentimiento" value={teen.fechaConsentimiento ? fmtDate(teen.fechaConsentimiento) : ""} />
        </div>
        {teen.gustos && (
          <div>
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1">
              Gustos e intereses
            </p>
            <p className="text-sm">{esc(teen.gustos)}</p>
          </div>
        )}
        {(teen.telefono || teen.telefonoPadre) && (
          <div className="pt-2 space-y-2">
            <button
              onClick={() => setShowQuickWA(true)}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 transition"
            >
              <WhatsAppIcon />
              Mensajes Rápidos
            </button>
            <button
              onClick={async () => {
                setGeneratingMsg(true);
                setAiMsgTone("aliento");
                setAiMsgTarget("teen");
                setAiMsg("Generando mensaje pastoral...");
                setShowAIMsg(true);
                const r = await generateMsg({ teenId: teen._id as any, tone: "aliento" }) as any;
                if (r.success) {
                  setAiMsg(sanitizeAiText(r.message || ""));
                } else {
                  setAiMsg("No se pudo generar el mensaje en este momento. Intenta nuevamente.");
                }
                setGeneratingMsg(false);
              }}
              disabled={generatingMsg}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 transition disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /><path d="M15 5l3 3" />
              </svg>
              {generatingMsg ? "Generando..." : "Mensaje con IA"}
            </button>
          </div>
        )}
      </div>

      <XpBar level={game.level} />
      <BadgeGrid badges={game.badges} />

      <TeenSummaryCard
        summary={teenSummary as TeenSummary | undefined}
        generating={generatingSummary}
        onGenerate={async () => {
          setGeneratingSummary(true);
          await generateSummary({ teenId: teen._id as any, token: token ?? undefined });
          setGeneratingSummary(false);
        }}
        hasData={(analyses as any[]).length > 0 || s.total > 0}
      />

      <PastoralPlanCard teenId={teen._id} />
      <PastoralTasksCard teenId={teen._id} />
      <TransitionsCard teenId={teen._id} />
      <JournalTimeline teenId={teen._id} />

      <AiSuggestions teenId={teen._id} />

      <div className="bg-card rounded-card shadow-soft p-5">
        <h2 className="font-display font-semibold text-base mb-3">
          Historial de asistencia
        </h2>
        {history.length === 0 ? (
          <div className="text-center py-8 px-4">
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
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M8 2v4M16 2v4M3 10h18" />
                <path d="M8.5 14.5l2 2 4-4" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ink/70">
              Sin historial
            </p>
            <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">
              Aún no hay registros de asistencia para este adolescente.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const m = statusMap[h.status] || {
                label: h.status,
                cls: "bg-ink/5 text-ink/50",
              };
              return (
                <div
                  key={h.date}
                  className="flex items-center justify-between text-sm py-1.5"
                >
                  <span className="text-ink/60">{fmtDate(h.date)}</span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.cls}`}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEdit && (
        <TeenForm
          teen={teen}
          onClose={() => setShowEdit(false)}
          onSuccess={() => setShowEdit(false)}
        />
      )}

      {showDelete && (
        <Modal
          title="Archivar adolescente"
          onClose={() => setShowDelete(false)}
        >
          <div className="p-5">
            <p className="text-sm text-ink/70">
              ¿Seguro que deseas archivar a{" "}
              <strong>
                {esc(teen.nombre)} {esc(teen.apellido)}
              </strong>
              ? Su ficha saldrá de los listados activos, pero se conservará su
              historial de asistencia, bitácora y auditoría.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 bg-ink/5 rounded-xl py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-coral-600 text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                Archivar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showWhatsApp && risk.score >= 1 && (
        <WhatsAppModal
          nombre={teen.nombre}
          telefono={teen.telefono}
          telefonoPadre={teen.telefonoPadre}
          templates={alertTemplates}
          onClose={() => setShowWhatsApp(false)}
        />
      )}

      {showQuickWA && (teen.telefono || teen.telefonoPadre) && (
        <WhatsAppModal
          nombre={teen.nombre}
          telefono={teen.telefono}
          telefonoPadre={teen.telefonoPadre}
          templates={allTemplates}
          onClose={() => setShowQuickWA(false)}
        />
      )}

      {showAIMsg && (
        <ResponsiveSheet title="Mensaje generado por IA" onClose={() => setShowAIMsg(false)} desktopMaxWidthClass="sm:max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={aiMsgTone}
                onChange={async (e) => {
                  setAiMsgTone(e.target.value);
                  setGeneratingMsg(true);
                  setAiMsg("Regenerando mensaje pastoral...");
                  const r = await generateMsg({ teenId: teen._id as any, tone: e.target.value }) as any;
                  if (r.success) setAiMsg(sanitizeAiText(r.message || ""));
                  else setAiMsg("No se pudo regenerar el mensaje en este momento. Intenta nuevamente.");
                  setGeneratingMsg(false);
                }}
                className="flex-1 bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm"
              >
                <option value="aliento">💪 Ánimo</option>
                <option value="correccion">❤️ Corrección</option>
                <option value="invitacion">📅 Invitación</option>
                <option value="celebracion">🎉 Celebración</option>
              </select>
              <select
                value={aiMsgTarget}
                onChange={(e) => setAiMsgTarget(e.target.value as "teen" | "parent")}
                className="bg-card border border-ink/10 rounded-xl px-3 py-2 text-sm"
              >
                <option value="teen">Al adolescente</option>
                <option value="parent">Al encargado</option>
              </select>
            </div>
              <textarea
                value={aiMsg}
                onChange={(e) => setAiMsg(e.target.value)}
                rows={5}
                disabled={generatingMsg}
                className="w-full bg-ink/[0.02] border border-ink/10 rounded-xl p-3.5 text-sm resize-none"
              />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const phone = aiMsgTarget === "parent" ? teen.telefonoPadre : teen.telefono;
                  if (!phone) return;
                  const url = `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(aiMsg)}`;
                  window.open(url, "_blank");
                }}
                disabled={!aiMsg || generatingMsg || (aiMsgTarget === "parent" ? !teen.telefonoPadre : !teen.telefono)}
                className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <WhatsAppIcon />
                Enviar por WhatsApp
              </button>
              <button
                onClick={() => setShowAIMsg(false)}
                className="flex-1 bg-ink/5 text-ink/60 rounded-xl py-2.5 text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </ResponsiveSheet>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function StatCardInline({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    ink: "text-ink bg-ink/5 dark:text-ink/80 dark:bg-ink/10",
    teal: "text-teal-700 bg-teal-50 dark:text-teal-400 dark:bg-teal-950/35 dark:border dark:border-teal-900/30",
    sage: "text-sage-600 bg-sage-50 dark:text-sage-400 dark:bg-sage-950/35 dark:border dark:border-sage-900/30",
    coral: "text-coral-600 bg-coral-50 dark:text-coral-400 dark:bg-coral-950/35 dark:border dark:border-coral-900/30",
    amber: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/35 dark:border dark:border-amber-900/30",
  };
  const icons: Record<string, string> = {
    check: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8.5 14.5l2 2 4-4"/>`,
    flame: `<path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c0-1-.3-1.7-.6-2.4.9.6 1.6 1.7 1.6 3.4 0 2.8-1.8 5-4 5s-5-2.5-5-6c0-3.5 2-6.6 5-8z"/>`,
    users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3"/>`,
  };
  return (
    <div className="bg-card rounded-card shadow-soft p-4">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[color] || ""}`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: icons[icon] || "" }}
        />
      </div>
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="text-xs text-ink/45 mt-1">{label}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p className="text-ink/80">{value ? esc(value) : "—"}</p>
    </div>
  );
}

function TeenSummaryCard({
  summary,
  generating,
  onGenerate,
  hasData,
}: {
  summary: TeenSummary | undefined;
  generating: boolean;
  onGenerate: () => void;
  hasData: boolean;
}) {
  if (!summary && !hasData) return null;
  return (
    <div className="bg-card rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-base flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
            <path d="M15 5l3 3" />
          </svg>
          Resumen Pastoral
        </h2>
        {!summary ? (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="text-xs font-semibold bg-teal-600 text-white rounded-full px-3 py-1.5 hover:bg-teal-700 disabled:opacity-50 transition"
          >
            {generating ? "Generando..." : "Generar resumen"}
          </button>
        ) : (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="text-xs font-semibold bg-ink/5 text-ink/50 hover:text-ink rounded-full px-3 py-1.5 disabled:opacity-50 transition"
          >
            {generating ? "Generando..." : "Regenerar"}
          </button>
        )}
      </div>
      {!summary ? (
        <p className="text-xs text-ink/40 text-center py-6">
          Genera un resumen inteligente con el historial de asistencia, análisis de IA y bitácoras de este adolescente.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
              summary.pastoralMomentum === "Mejorando" || summary.pastoralMomentum === "Estable"
                ? "bg-green-50 text-green-700"
                : summary.pastoralMomentum === "Requiere atención"
                ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700"
            }`}>
              {summary.pastoralMomentum}
            </span>
          </div>
          <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-line">
            {summary.summary}
          </p>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-ink/[0.03] border border-ink/5">
              <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-1">Desafío principal</p>
              <p className="text-sm text-ink/80">{summary.mainChallenge}</p>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide mb-1">Enfoque recomendado</p>
              <p className="text-sm text-teal-800">{summary.recommendedFocus}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AiSuggestions({ teenId }: { teenId: string }) {
  const analyses = useQuery(api.ai.getAnalysisByTeen, { teenId: teenId as any }) ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);
  if ((analyses as any[]).length === 0) return null;
  const highRisk = (analyses as any[]).filter((a: any) => a.riskLevel === "high");
  const confidenceLabel: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta" };
  const sourceLabel: Record<string, string> = {
    journal: "Bitácora",
    attendance: "Asistencia",
    teen_profile: "Ficha",
    pastoral_plan: "Plan pastoral",
    pastoral_tasks: "Tareas",
    previous_ai_analysis: "IA previa",
  };
  return (
    <div className="bg-card rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold text-base">
          Sugerencias pastorales de IA
        </h2>
        {highRisk.length > 0 && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
            {highRisk.length} alerta{highRisk.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {(analyses as any[]).map((a: any) => (
          <div key={a._id}>
            <button
              onClick={() => setExpanded(expanded === a._id ? null : a._id)}
              className="w-full flex items-center gap-2 text-left"
            >
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                a.riskLevel === "high" ? "bg-red-50 text-red-700" : a.riskLevel === "medium" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
              }`}>
                {a.riskLevel === "high" ? "🔴" : a.riskLevel === "medium" ? "🟡" : "🟢"} Nivel sugerido: {a.riskLevel === "high" ? "Alto" : a.riskLevel === "medium" ? "Medio" : "Bajo"}
              </span>
              <span className="text-xs text-ink/40 flex-1 truncate">{a.summary}</span>
              <svg className={`w-3 h-3 text-ink/30 transition ${expanded === a._id ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expanded === a._id && (
              <div className="mt-2 ml-6 p-3 rounded-lg bg-ink/[0.03] border border-ink/5 space-y-2">
                <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-xs text-purple-900 space-y-1">
                  <p className="font-semibold">Requiere revisión humana: Sí</p>
                  <p><span className="font-semibold">Confianza:</span> {confidenceLabel[a.confidence || "low"]}</p>
                  {a.reasoningSummary && <p><span className="font-semibold">Motivo:</span> {a.reasoningSummary}</p>}
                  {a.usedDataSources?.length > 0 && (
                    <p><span className="font-semibold">Datos usados:</span> {(a.usedDataSources as string[]).map((s) => sourceLabel[s] || s).join(", ")}</p>
                  )}
                  <p>{a.pastoralDisclaimer || "Esta sugerencia requiere revisión humana pastoral."}</p>
                </div>
                {a.vulnerabilityTags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(a.vulnerabilityTags as string[]).map((tag: string) => {
                      const meta = VULNERABILITY_TAGS.find((t) => t.id === tag);
                      return <span key={tag} className="text-[10px] font-medium bg-ink/5 text-ink/50 px-1.5 py-0.5 rounded-full">{meta ? `${meta.icon} ${meta.label}` : tag}</span>;
                    })}
                  </div>
                )}
                {a.suggestedActions?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-1">Acciones sugeridas</p>
                    <ul className="space-y-1">
                      {(a.suggestedActions as string[]).map((action: string, i: number) => (
                        <li key={i} className="text-xs text-ink/70 flex items-start gap-1.5">
                          <span className="text-teal-600 mt-0.5">▶</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.suggestedVerses?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide mb-1">Versículos sugeridos</p>
                    <div className="flex flex-wrap gap-1">
                      {(a.suggestedVerses as string[]).map((verse: string, i: number) => (
                        <span key={i} className="text-xs font-medium bg-teal-50 text-teal-700 px-2 py-1 rounded-full">📖 {verse}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
