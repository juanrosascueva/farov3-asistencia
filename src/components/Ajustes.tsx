import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, MessageTemplate } from "../lib/types";
import { downloadFile, fmtDate } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import { useTemplates } from "../hooks/useTemplates";
import { usePastoralTarget } from "../hooks/usePastoralTarget";
import Modal from "./Modal";


interface AjustesProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  dark?: boolean;
  setDark?: (v: boolean) => void;
}

export default function Ajustes({ teens, attendanceMap, dark, setDark }: AjustesProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);
  const [importing, setImporting] = useState(false);

  const { user, token } = useAuth();

  const { templates, addTemplate, updateTemplate, deleteTemplate, resetTemplates } = useTemplates();
  const [editTpl, setEditTpl] = useState<MessageTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState<MessageTemplate["category"]>("general");
  const [tplRecipient, setTplRecipient] = useState<MessageTemplate["recipient"]>("teen");
  const [tplText, setTplText] = useState("");
  const [tplEmoji, setTplEmoji] = useState("💬");
  const [showTplForm, setShowTplForm] = useState(false);

  const { pastoralTargetCoverage, setPastoralTargetCoverage } = usePastoralTarget();

  const createTeen = useMutation(api.teens.create);
  const recordExport = useMutation(api.auditLog.recordExport);

  const handleExportJson = async () => {
    const data = { teens, attendance: attendanceMap };
    if (token) {
      await recordExport({ token, exportType: "respaldo_json", recordCount: teens.length, details: "Respaldo completo de adolescentes y asistencia." });
    }
    downloadFile(
      "faro_respaldo.json",
      JSON.stringify(data, null, 2),
      "application/json"
    );
  };

  const handleExportCsv = async () => {
    const dates = Object.keys(attendanceMap).sort();
    let csv = "Nombre,Apellido," + dates.map(fmtDate).join(",") + "\n";
    teens.forEach((t) => {
      csv +=
        `${t.nombre},${t.apellido},` +
        dates.map((d) => attendanceMap[d]?.[t._id] || "").join(",") +
        "\n";
    });
    if (token) {
      await recordExport({ token, exportType: "asistencia_csv", recordCount: teens.length, details: `${dates.length} fechas exportadas.` });
    }
    downloadFile("faro_asistencia.csv", csv, "text/csv");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.teens) {
          for (const t of data.teens) {
            await createTeen({
              nombre: t.nombre || "",
              apellido: t.apellido || "",
              nacimiento: t.nacimiento || "",
              telefono: t.telefono || "",
              telefonoPadre: t.telefonoPadre || "",
              gustos: t.gustos || "",
              notas: t.notas || "",
              foto: t.foto || "",
              token: token ?? undefined,
            });
          }
          alert("Importación completada con éxito");
        }
      } catch {
        alert("Archivo inválido");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <p className="text-xs font-semibold text-primary-700 tracking-wide uppercase">
          Configuración
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">Ajustes</h1>
      </div>

      <div className="bg-card rounded-card shadow-soft divide-y divide-ink/5">
        <button
          onClick={handleExportJson}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">Exportar datos (JSON)</p>
            <p className="text-xs text-ink/40">Respaldo completo de adolescentes y asistencia</p>
          </div>
        </button>

        <button onClick={handleExportCsv} className="w-full flex items-center gap-3 p-4 text-left">
          <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">Exportar asistencia (CSV)</p>
            <p className="text-xs text-ink/40">Tabla de asistencia para abrir en Excel/Sheets</p>
          </div>
        </button>

        <label className={`w-full flex items-center gap-3 p-4 text-left ${importing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
          {importing ? (
            <svg className="animate-spin h-5 w-5 text-primary-600 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-primary-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold">{importing ? "Importando respaldo..." : "Importar respaldo (JSON)"}</p>
            <p className="text-xs text-ink/40">{importing ? "Espere, por favor. Sincronizando registros con la nube." : "Restaurar desde un archivo exportado previamente"}</p>
          </div>
          <input ref={importRef} type="file" accept=".json" className="hidden" disabled={importing} onChange={handleImport} />
        </label>
      </div>

      <div className="bg-card rounded-card shadow-soft p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Modo oscuro</p>
          <p className="text-xs text-ink/40">Activa el tema oscuro para toda la aplicación</p>
        </div>
        <button
          onClick={() => setDark?.(!dark)}
          className={`w-11 h-6 rounded-full relative transition-colors ${dark ? "bg-primary-600" : "bg-ink/20"}`}
        >
          <div className={`w-5 h-5 bg-card rounded-full absolute top-0.5 shadow transition-transform ${dark ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
            Meta Pastoral de Cobertura
          </p>
          <p className="text-sm text-ink/60 mt-0.5">
            Define el porcentaje ideal de jóvenes que deben recibir al menos un contacto pastoral cada mes.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-display font-bold text-primary-700 w-14">
            {pastoralTargetCoverage}%
          </span>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={pastoralTargetCoverage}
            onChange={(e) => setPastoralTargetCoverage(Number(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-ink/10 cursor-pointer accent-primary-600
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-600 [&::-webkit-slider-thumb]:shadow"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-ink/40">
          <span>50%</span>
          <span className="font-semibold text-ink/60">Meta actual: {pastoralTargetCoverage}%</span>
          <span>100%</span>
        </div>
      </div>



      {/* ─── WhatsApp Templates ─── */}
      <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
            Plantillas de WhatsApp
          </p>
          <p className="text-sm text-ink/60 mt-0.5">
            Personaliza los mensajes que se envían desde el perfil de cada adolescente.
          </p>
        </div>

        {showTplForm ? (
          <div className="bg-ink/[0.02] border border-ink/10 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">{editTpl ? "Editar plantilla" : "Nueva plantilla"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink/50 mb-1 block">Nombre</label>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  placeholder="Ej: Una falta (cálido)"
                  className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink/50 mb-1 block">Emoji</label>
                <input
                  type="text"
                  value={tplEmoji}
                  onChange={(e) => setTplEmoji(e.target.value)}
                  placeholder="🟡"
                  maxLength={3}
                  className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink/50 mb-1 block">Categoría</label>
                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value as MessageTemplate["category"])}
                  className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
                >
                  <option value="absence">Ausencias</option>
                  <option value="streak">Racha / Incentivo</option>
                  <option value="birthday">Cumpleaños</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-ink/50 mb-1 block">Destinatario</label>
                <select
                  value={tplRecipient}
                  onChange={(e) => setTplRecipient(e.target.value as MessageTemplate["recipient"])}
                  className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2 text-base"
                >
                  <option value="teen">Adolescente</option>
                  <option value="parent">Tutor / Encargado</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Texto del mensaje
              </label>
              <textarea
                value={tplText}
                onChange={(e) => setTplText(e.target.value)}
                rows={4}
                className="w-full bg-card border border-ink/10 rounded-xl px-3.5 py-2.5 text-base resize-none"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {["{nombre}", "{apellido}", "{racha}", "{faltas}", "{telefono_padre}"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTplText((prev) => prev + " " + v)}
                    className="text-xs font-mono bg-ink/5 hover:bg-ink/10 rounded-md px-2 py-0.5 text-ink/60"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!tplName.trim() || !tplText.trim()) return;
                  if (editTpl) {
                    updateTemplate(editTpl.id, {
                      name: tplName.trim(),
                      category: tplCategory,
                      recipient: tplRecipient,
                      text: tplText.trim(),
                      emoji: tplEmoji,
                    });
                  } else {
                    addTemplate({
                      name: tplName.trim(),
                      category: tplCategory,
                      recipient: tplRecipient,
                      text: tplText.trim(),
                      emoji: tplEmoji,
                    });
                  }
                  setShowTplForm(false);
                  setEditTpl(null);
                }}
                className="flex-1 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                {editTpl ? "Guardar cambios" : "Agregar plantilla"}
              </button>
              <button
                onClick={() => { setShowTplForm(false); setEditTpl(null); }}
                className="flex-1 bg-ink/5 text-ink/60 rounded-xl py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setTplName(""); setTplEmoji("💬"); setTplCategory("general"); setTplRecipient("teen"); setTplText("");
              setEditTpl(null); setShowTplForm(true);
            }}
            className="flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-600 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Nueva plantilla
          </button>
        )}

        <div className="space-y-3">
          {(["absence", "streak", "birthday", "general"] as const).map((cat) => {
            const group = templates.filter((t) => t.category === cat);
            if (group.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide mb-1.5">
                  {cat === "absence" ? "Ausencias" : cat === "streak" ? "Rachas" : cat === "birthday" ? "Cumpleaños" : "General"}
                </p>
                <div className="space-y-1">
                  {group.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 py-2 px-3 rounded-xl bg-ink/[0.02] border border-ink/5"
                    >
                      <span className="text-sm shrink-0">{t.emoji}</span>
                      <span className="flex-1 text-sm min-w-0 truncate">{t.name}</span>
                      <span className="text-[10px] font-semibold text-ink/40 uppercase px-1.5 py-0.5 rounded-full bg-ink/5">
                        {t.recipient === "teen" ? "Joven" : "Tutor"}
                      </span>
                      <button
                        onClick={() => {
                          setEditTpl(t);
                          setTplName(t.name);
                          setTplCategory(t.category);
                          setTplRecipient(t.recipient);
                          setTplText(t.text);
                          setTplEmoji(t.emoji);
                          setShowTplForm(true);
                        }}
                        className="w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-primary-600 hover:bg-primary-50 transition"
                        title="Editar"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-danger-600 hover:bg-danger-50 transition"
                        title="Eliminar"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={resetTemplates}
          className="text-xs font-semibold text-ink/40 hover:text-danger-600 transition"
        >
          Restablecer plantillas de fábrica
        </button>
      </div>

      <div className="bg-danger-50 border border-danger-100 rounded-card p-4">
        <p className="text-sm font-semibold text-danger-700">Archivar adolescentes activos</p>
        <p className="text-xs text-danger-700/70 mt-0.5 mb-3">Esta acción oculta las fichas activas, pero conserva asistencia, bitácoras y auditoría.</p>
        <button onClick={() => setShowReset(true)} className="text-xs font-semibold bg-danger-600 text-white rounded-full px-3.5 py-2">Archivar todo</button>
      </div>

      <div className="bg-primary-50/70 border border-primary-100 rounded-card p-5"><p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Consentimientos y ciclo de ficha</p><p className="mt-1 text-sm text-ink/65">{teens.filter((teen: any) => !teen.consentimientoDatos || !teen.consentimientoFoto).length} ficha(s) tienen consentimiento pendiente. Revisa la ficha y valida con el apoderado antes de usar mensajería o fotografías.</p><p className="mt-3 text-xs text-ink/50">Política operativa: egresados, trasladados e inactivos conservan su historial, salen de las listas activas y se excluyen de los indicadores operativos.</p></div>

      <p className="text-center text-xs text-ink/30 pt-2">Congregación Cristo Vive · Control de asistencia</p>

      {showReset && (
        <Modal title="Archivar adolescentes activos" onClose={() => setShowReset(false)}>
          <ResetForm onCancel={() => setShowReset(false)} />
        </Modal>
      )}
    </div>
  );
}

function ResetForm({ onCancel }: { onCancel: () => void }) {
  const resetAll = useMutation(api.teens.removeAll);
  const { token } = useAuth();
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetAll({ token: token ?? undefined });
      onCancel();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-5">
      <p className="text-sm text-ink/70">
        Esto archivará todas las fichas activas. Los historiales de asistencia y bitácora se conservarán para auditoría.
      </p>
      <div className="flex gap-3 mt-5">
        <button
          onClick={onCancel}
          disabled={resetting}
          className="flex-1 bg-ink/5 text-ink/60 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 pressable"
        >
          Cancelar
        </button>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex-1 bg-danger-600 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 pressable flex items-center justify-center gap-1.5"
        >
          {resetting && (
            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {resetting ? "Archivando..." : "Archivar todo"}
        </button>
      </div>
    </div>
  );
}
