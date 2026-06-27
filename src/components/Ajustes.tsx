import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap, Leader } from "../lib/types";
import { downloadFile, fmtDate } from "../lib/utils";
import { useLeaderContext } from "../hooks/useLeaders";
import Modal from "./Modal";

interface AjustesProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
}

export default function Ajustes({ teens, attendanceMap }: AjustesProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);

  const { leaders, currentLeader, currentLeaderId, addLeader, deleteLeader, setCurrentLeader } =
    useLeaderContext();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Leader["role"]>("leader");
  const [adding, setAdding] = useState(false);

  const createTeen = useMutation(api.teens.create);

  const handleExportJson = () => {
    const data = { teens, attendance: attendanceMap };
    downloadFile(
      "faro_respaldo.json",
      JSON.stringify(data, null, 2),
      "application/json"
    );
  };

  const handleExportCsv = () => {
    const dates = Object.keys(attendanceMap).sort();
    let csv = "Nombre,Apellido," + dates.map(fmtDate).join(",") + "\n";
    teens.forEach((t) => {
      csv +=
        `${t.nombre},${t.apellido},` +
        dates.map((d) => attendanceMap[d]?.[t._id] || "").join(",") +
        "\n";
    });
    downloadFile("faro_asistencia.csv", csv, "text/csv");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
            });
          }
        }
      } catch {
        alert("Archivo inválido");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Configuración
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">Ajustes</h1>
      </div>

      <div className="bg-white rounded-card shadow-soft divide-y divide-ink/5">
        <button
          onClick={handleExportJson}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">Exportar datos (JSON)</p>
            <p className="text-xs text-ink/40">Respaldo completo de adolescentes y asistencia</p>
          </div>
        </button>

        <button onClick={handleExportCsv} className="w-full flex items-center gap-3 p-4 text-left">
          <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">Exportar asistencia (CSV)</p>
            <p className="text-xs text-ink/40">Tabla de asistencia para abrir en Excel/Sheets</p>
          </div>
        </button>

        <label className="w-full flex items-center gap-3 p-4 text-left cursor-pointer">
          <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          <div className="flex-1">
            <p className="text-sm font-semibold">Importar respaldo (JSON)</p>
            <p className="text-xs text-ink/40">Restaurar desde un archivo exportado previamente</p>
          </div>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </label>
      </div>

      <div className="bg-white rounded-card shadow-soft p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Modo oscuro</p>
          <p className="text-xs text-ink/40">Próximamente</p>
        </div>
        <div className="w-11 h-6 rounded-full bg-ink/10 relative opacity-50">
          <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow" />
        </div>
      </div>

      <div className="bg-white rounded-card shadow-soft p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
            Equipo de Líderes
          </p>
          <p className="text-sm text-ink/60 mt-0.5">
            Gestiona quiénes están usando la aplicación.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink/50 mb-1.5 block">
            ¿Quién está usando la aplicación?
          </label>
          <select
            value={currentLeaderId || ""}
            onChange={(e) => setCurrentLeader(e.target.value || null)}
            className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
          >
            <option value="">— Sin sesión activa —</option>
            {leaders.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({roleLabel(l.role)})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide">
            Líderes registrados ({leaders.length})
          </p>
          {leaders.length === 0 ? (
            <p className="text-sm text-ink/30 py-2">Aún no hay líderes. Agrega uno debajo.</p>
          ) : (
            <div className="space-y-1.5">
              {leaders.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl bg-ink/[0.02] border border-ink/5"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      background:
                        l.role === "pastor"
                          ? "#0B7285"
                          : l.role === "teacher"
                          ? "#2F9E73"
                          : l.role === "leader"
                          ? "#E08F22"
                          : "#E8590C",
                    }}
                  />
                  <span className="flex-1 text-sm font-medium min-w-0 truncate">
                    {l.name}
                  </span>
                  <span className="text-[10px] font-semibold text-ink/40 uppercase px-2 py-0.5 rounded-full bg-ink/5">
                    {roleLabel(l.role)}
                  </span>
                  {currentLeaderId !== l.id && (
                    <button
                      onClick={() => deleteLeader(l.id)}
                      className="shrink-0 w-6 h-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/30 hover:text-coral-600 hover:bg-coral-50 transition"
                      title="Eliminar líder"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {adding ? (
          <div className="bg-ink/[0.02] border border-ink/10 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold">Agregar líder</p>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Nombre completo
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Carlos Mendoza"
                className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/50 mb-1 block">
                Rol
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Leader["role"])}
                className="w-full bg-white border border-ink/10 rounded-xl px-3.5 py-2.5 text-sm"
              >
                <option value="pastor">Pastor</option>
                <option value="teacher">Maestro</option>
                <option value="leader">Líder</option>
                <option value="helper">Ayudante</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newName.trim()) {
                    addLeader(newName.trim(), newRole);
                    setNewName("");
                    setNewRole("leader");
                    setAdding(false);
                  }
                }}
                className="flex-1 bg-ink text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                Agregar
              </button>
              <button
                onClick={() => setAdding(false)}
                className="flex-1 bg-ink/5 text-ink/60 rounded-xl py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-600 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Agregar líder
          </button>
        )}
      </div>

      <div className="bg-coral-50 border border-coral-100 rounded-card p-4">
        <p className="text-sm font-semibold text-coral-700">Reiniciar todos los datos</p>
        <p className="text-xs text-coral-700/70 mt-0.5 mb-3">Esta acción borra permanentemente a todos los adolescentes y registros de asistencia.</p>
        <button onClick={() => setShowReset(true)} className="text-xs font-semibold bg-coral-600 text-white rounded-full px-3.5 py-2">Borrar todo</button>
      </div>

      <p className="text-center text-[11px] text-ink/30 pt-2">Faro · Control de asistencia para ministerio de adolescentes</p>

      {showReset && (
        <Modal title="Borrar todos los datos" onClose={() => setShowReset(false)}>
          <ResetForm onCancel={() => setShowReset(false)} />
        </Modal>
      )}
    </div>
  );
}

function roleLabel(role: Leader["role"]): string {
  return (
    { pastor: "Pastor", teacher: "Maestro", leader: "Líder", helper: "Ayudante" } as Record<string, string>
  )[role] || role;
}

function ResetForm({ onCancel }: { onCancel: () => void }) {
  const resetAll = useMutation(api.teens.removeAll);
  return (
    <div className="p-5">
      <p className="text-sm text-ink/70">
        Esto eliminará permanentemente a todos los adolescentes y todo el historial de asistencia. No se puede deshacer.
      </p>
      <div className="flex gap-3 mt-5">
        <button onClick={onCancel} className="flex-1 bg-ink/5 rounded-xl py-2.5 text-sm font-semibold">Cancelar</button>
        <button onClick={() => { resetAll(); onCancel(); }} className="flex-1 bg-coral-600 text-white rounded-xl py-2.5 text-sm font-semibold">Borrar todo</button>
      </div>
    </div>
  );
}
