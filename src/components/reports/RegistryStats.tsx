import type { Doc } from "../../../convex/_generated/dataModel";
import { getPrimaryGuardianName, getTeenContactWarnings, getTeenStatus, teenProfileCompleteness, TEEN_STATUS_META } from "../../lib/utils";

export default function RegistryStats({ teens }: { teens: Doc<"teens">[] }) {
  const summaries = teens.map((teen) => ({
    teen,
    completeness: teenProfileCompleteness(teen),
    warnings: getTeenContactWarnings(teen),
    status: getTeenStatus(teen),
  }));

  const avgCompleteness = summaries.length
    ? Math.round(summaries.reduce((acc, item) => acc + item.completeness.percent, 0) / summaries.length)
    : 0;
  const noGuardian = summaries.filter((item) => !item.teen.nombreEncargado).length;
  const noFamilyPhone = summaries.filter((item) => !item.teen.telefonoPadre && !item.teen.contactoEmergenciaTelefono).length;
  const inactives = summaries.filter((item) => item.status === "inactivo").length;
  const statusBuckets = Object.keys(TEEN_STATUS_META).map((status) => ({
    status,
    count: summaries.filter((item) => item.status === status).length,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Completitud promedio" value={`${avgCompleteness}%`} sub="fichas pastorales" />
        <KpiCard label="Sin tutor" value={noGuardian} sub="fichas por completar" />
        <KpiCard label="Sin contacto familiar" value={noFamilyPhone} sub="riesgo operativo" />
        <KpiCard label="Inactivos" value={inactives} sub="requieren revisión" />
      </div>

      <div className="bg-card rounded-card shadow-soft p-5 space-y-4">
        <h2 className="font-display font-semibold text-base">Estado del registro</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statusBuckets.map((bucket) => (
            <div key={bucket.status} className="rounded-2xl border border-ink/10 p-4">
              <p className="text-2xl font-bold font-display">{bucket.count}</p>
              <p className="text-xs font-semibold text-ink/55">{TEEN_STATUS_META[bucket.status as keyof typeof TEEN_STATUS_META].label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-card shadow-soft p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display font-semibold text-base">Alertas de fichas</h2>
          <span className="text-xs text-ink/40">Top 8 prioridades</span>
        </div>
        <div className="space-y-3">
          {summaries
            .sort((a, b) => a.completeness.percent - b.completeness.percent || b.warnings.length - a.warnings.length)
            .slice(0, 8)
            .map((item) => (
              <div key={item.teen._id} className="rounded-2xl border border-ink/10 px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.teen.nombre} {item.teen.apellido}</p>
                    <p className="text-xs text-ink/45 truncate">Tutor: {getPrimaryGuardianName(item.teen)}</p>
                  </div>
                  <span className="text-xs font-semibold text-ink/55">{item.completeness.percent}% completo</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.warnings.length > 0 ? item.warnings.map((warning) => (
                    <span key={warning} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 border border-amber-100">
                      {warning}
                    </span>
                  )) : (
                    <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 border border-green-100">
                      Ficha al día
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-card rounded-card shadow-soft p-4">
      <p className="text-2xl font-bold font-display text-ink">{value}</p>
      <p className="text-xs font-semibold text-ink/60 mt-0.5">{label}</p>
      <p className="text-[11px] text-ink/40">{sub}</p>
    </div>
  );
}
