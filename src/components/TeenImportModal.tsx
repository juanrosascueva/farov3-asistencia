import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { createTeenCsvTemplate, downloadFile } from "../lib/utils";
import ResponsiveSheet from "./ResponsiveSheet";

interface TeenImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type PreviewRow = {
  row: number;
  data: Record<string, string>;
  errors: string[];
};

const REQUIRED_HEADERS = ["nombre", "apellido"];

export default function TeenImportModal({ onClose, onSuccess }: TeenImportModalProps) {
  const createTeen = useMutation(api.teens.create);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const validRows = useMemo(() => rows.filter((row) => row.errors.length === 0), [rows]);

  const handleFile = async (file: File) => {
    setError("");
    setLoading(true);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseDelimited(text);
      if (parsed.length < 2) throw new Error("El archivo no contiene datos suficientes.");
      const headers = parsed[0].map(normalizeHeader);
      for (const required of REQUIRED_HEADERS) {
        if (!headers.includes(required)) throw new Error(`Falta la columna obligatoria '${required}'.`);
      }
      const preview = parsed.slice(1).filter((line) => line.some((cell) => cell.trim())).map((line, index) => {
        const data = Object.fromEntries(headers.map((header, i) => [header, (line[i] || "").trim()]));
        const errors: string[] = [];
        if (!data.nombre) errors.push("Falta nombre");
        if (!data.apellido) errors.push("Falta apellido");
        if (data.nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(data.nacimiento)) errors.push("Fecha de nacimiento inválida");
        if (data.fechaIngreso && !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaIngreso)) errors.push("Fecha de ingreso inválida");
        if (data.fechaConsentimiento && !/^\d{4}-\d{2}-\d{2}$/.test(data.fechaConsentimiento)) errors.push("Fecha de consentimiento inválida");
        if (data.estado && !["activo", "visitante", "nuevo", "seguimiento", "inactivo", "trasladado", "egresado"].includes(data.estado)) errors.push("Estado inválido");
        return { row: index + 2, data, errors };
      });
      setRows(preview);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "No se pudo leer el archivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setSubmitting(true);
    setError("");
    try {
      for (const row of validRows) {
        const data = row.data;
        await createTeen({
          nombre: data.nombre || "",
          apellido: data.apellido || "",
          nacimiento: data.nacimiento || "",
          sexo: (data.sexo || undefined) as any,
          telefono: data.telefono || "",
          telefonoPadre: data.telefonoPadre || "",
          telefonoSecundario: data.telefonoSecundario || undefined,
          nombreEncargado: data.nombreEncargado || undefined,
          parentescoEncargado: data.parentescoEncargado || undefined,
          contactoEmergenciaNombre: data.contactoEmergenciaNombre || undefined,
          contactoEmergenciaTelefono: data.contactoEmergenciaTelefono || undefined,
          permiteMensajes: parseBoolean(data.permiteMensajes),
          gustos: data.gustos || "",
          notas: "",
          observacionInicial: data.observacionInicial || undefined,
          foto: "",
          fechaIngreso: data.fechaIngreso || undefined,
          estado: (data.estado || undefined) as any,
          motivoInactividad: data.motivoInactividad || undefined,
          colegio: data.colegio || undefined,
          gradoEscolar: data.gradoEscolar || undefined,
          barrio: data.barrio || undefined,
          viveCon: data.viveCon || undefined,
          decisionEspiritual: (data.decisionEspiritual || undefined) as any,
          requiereSeguimientoEspecial: parseBoolean(data.requiereSeguimientoEspecial),
          consentimientoDatos: parseBoolean(data.consentimientoDatos),
          consentimientoFoto: parseBoolean(data.consentimientoFoto),
          fechaConsentimiento: data.fechaConsentimiento || undefined,
        } as any);
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "No se pudo completar la importación.");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
      <button onClick={onClose} className="rounded-xl border border-ink/10 px-4 py-2.5 text-sm font-semibold text-ink/60 w-full sm:w-auto order-2 sm:order-none">
        Cerrar
      </button>
      <button
        onClick={handleImport}
        disabled={submitting || validRows.length === 0}
        className="rounded-xl bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 w-full sm:w-auto order-1 sm:order-none"
      >
        {submitting ? "Importando..." : `Importar ${validRows.length} registros`}
      </button>
    </div>
  );

  return (
    <ResponsiveSheet title="Importar adolescentes" onClose={onClose} desktopMaxWidthClass="sm:max-w-4xl" footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Carga masiva compatible con Excel</p>
            <p className="text-xs text-ink/45 mt-1">Exporta tu hoja como CSV y aquí obtendrás validación previa antes de guardar.</p>
          </div>
          <button
            onClick={() => downloadFile("plantilla-adolescentes.csv", createTeenCsvTemplate(), "text/csv;charset=utf-8")}
            className="rounded-xl border border-ink/10 px-3.5 py-2 text-sm font-semibold text-ink/60"
          >
            Descargar plantilla CSV
          </button>
        </div>

        <label className="block rounded-2xl border border-dashed border-ink/15 bg-ink/[0.02] p-5 text-center cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <p className="text-sm font-semibold text-ink">{loading ? "Leyendo archivo..." : fileName || "Selecciona un archivo CSV"}</p>
          <p className="text-xs text-ink/40 mt-1">Columnas mínimas: `nombre`, `apellido`.</p>
        </label>

        {error && <div className="rounded-2xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">{error}</div>}

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard label="Filas leídas" value={rows.length} />
              <StatCard label="Filas válidas" value={validRows.length} />
              <StatCard label="Con errores" value={rows.length - validRows.length} />
            </div>
            <div className="hidden md:block max-h-[26rem] overflow-auto rounded-2xl border border-ink/10">
              <table className="w-full text-sm">
                <thead className="bg-ink/[0.03] sticky top-0">
                  <tr className="text-left text-ink/55">
                    <th className="px-3 py-2">Fila</th>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Tutor</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.row} className="border-t border-ink/5 align-top">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2 font-medium">{row.data.nombre} {row.data.apellido}</td>
                      <td className="px-3 py-2 text-ink/60">{row.data.nombreEncargado || row.data.telefonoPadre || "—"}</td>
                      <td className="px-3 py-2 text-ink/60">{row.data.estado || "activo"}</td>
                      <td className="px-3 py-2">
                        {row.errors.length === 0 ? (
                          <span className="rounded-full bg-success-50 px-2 py-1 text-xs font-semibold text-success-700">Lista</span>
                        ) : (
                          <div className="space-y-1">
                            {row.errors.map((item) => (
                              <p key={item} className="text-xs text-danger-600">{item}</p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {rows.map((row) => (
                <div key={row.row} className="rounded-2xl border border-ink/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">Fila {row.row} · {row.data.nombre} {row.data.apellido}</p>
                      <p className="text-xs text-ink/45 mt-1">Tutor: {row.data.nombreEncargado || row.data.telefonoPadre || "—"}</p>
                      <p className="text-xs text-ink/45">Estado: {row.data.estado || "activo"}</p>
                    </div>
                    {row.errors.length === 0 ? (
                      <span className="rounded-full bg-success-50 px-2 py-1 text-xs font-semibold text-success-700 shrink-0">Lista</span>
                    ) : (
                      <span className="rounded-full bg-danger-50 px-2 py-1 text-xs font-semibold text-danger-700 shrink-0">Error</span>
                    )}
                  </div>
                  {row.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {row.errors.map((item) => (
                        <p key={item} className="text-xs text-danger-600">{item}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </ResponsiveSheet>
  );
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/^\ufeff/, "");
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["si", "sí", "true", "1", "x"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  return undefined;
}

function parseDelimited(input: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-4 text-center sm:text-left">
      <p className="text-2xl font-bold font-display text-ink">{value}</p>
      <p className="text-xs font-semibold text-ink/50">{label}</p>
    </div>
  );
}
