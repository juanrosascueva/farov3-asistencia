import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { downloadFile, fmtDate } from "../lib/utils";
import Modal from "./Modal";

interface AjustesProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
}

export default function Ajustes({ teens, attendanceMap }: AjustesProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [showReset, setShowReset] = useState(false);

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
