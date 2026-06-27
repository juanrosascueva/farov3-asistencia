import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { fmtDate, esc } from "../lib/utils";
import { useLeaderContext } from "../hooks/useLeaders";

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

export default function JournalTimeline({ teenId }: JournalProps) {
  const entries = useQuery(api.journal.list, { teenId: teenId as any });
  const createEntry = useMutation(api.journal.create);
  const deleteEntry = useMutation(api.journal.remove);
  const { leaders, currentLeader } = useLeaderContext();

  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("other");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaderName, setLeaderName] = useState(currentLeader?.name || "");
  const [customLeader, setCustomLeader] = useState(false);
  const [followUp, setFollowUp] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !leaderName.trim()) return;
    await createEntry({
      teenId: teenId as any,
      entryDate,
      content: content.trim(),
      category: category as any,
      leaderName: leaderName.trim(),
      followUp,
    });
    setContent("");
    setLeaderName("");
    setFollowUp(false);
    setShowForm(false);
  };

  return (
    <div className="bg-white rounded-card shadow-soft p-5">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Fecha
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2 text-sm"
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
            {customLeader ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="Nombre del líder"
                  required
                  className="flex-1 bg-white border border-ink/10 rounded-xl px-3.5 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { setCustomLeader(false); setLeaderName(currentLeader?.name || ""); }}
                  className="shrink-0 px-3 py-2 text-xs font-semibold text-ink/50 hover:text-ink bg-ink/5 rounded-xl"
                >
                  Volver
                </button>
              </div>
            ) : (
              <select
                value={leaders.some((l) => l.name === leaderName) ? leaderName : ""}
                onChange={(e) => {
                  if (e.target.value === "__other__") {
                    setCustomLeader(true);
                    setLeaderName("");
                  } else {
                    setLeaderName(e.target.value);
                  }
                }}
                className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2 text-sm"
              >
                <option value="">Seleccionar líder...</option>
                {leaders.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
                <option value="__other__">✏️ Otro (escribir nombre)</option>
              </select>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/50 mb-1 block">
              Contenido
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Describe la llamada, visita o conversación..."
              required
              className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm resize-none"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
              className="w-4 h-4 rounded border-ink/20 text-coral-600 focus:ring-coral-500"
            />
            <span className="text-sm text-ink/70">
              <span className="font-semibold">Requiere seguimiento</span>
              <span className="text-xs text-ink/40 ml-1">
                — aparecerá en el panel de inicio
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
              return (
                <div key={entry._id} className="relative pl-10">
                  <div
                    className={`absolute left-[9px] w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center text-[10px] ${meta.color}`}
                  >
                    {meta.icon}
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
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
                      </div>
                      <p className="text-xs text-ink/40 font-medium">
                        por {esc(entry.leaderName || "Anónimo")}
                      </p>
                      <p className="text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                        {esc(entry.content)}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteEntry({ id: entry._id })}
                      className="shrink-0 w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-coral-600 hover:bg-coral-50 transition mt-1"
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
    </div>
  );
}
