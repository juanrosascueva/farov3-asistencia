import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Doc } from "../../convex/_generated/dataModel";

interface Props {
  teens: Doc<"teens">[];
  allJournal: Doc<"journal">[];
  followUps: Doc<"journal">[];
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  call: { label: "Llamada", color: "#0B7285" },
  visit: { label: "Visita", color: "#26815E" },
  chat: { label: "WhatsApp", color: "#25D366" },
  counseling: { label: "Consejería", color: "#E08F22" },
  prayer: { label: "Oración", color: "#C94C0A" },
  other: { label: "Nota", color: "#8B8FA3" },
};

export default function PastoralStats({ teens, allJournal, followUps }: Props) {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const recentJournal = allJournal.filter((e) => e.entryDate >= cutoff);
  const teensWithRecentJournal = new Set(recentJournal.map((e) => e.teenId));
  const coveragePct = teens.length
    ? Math.round((teensWithRecentJournal.size / teens.length) * 100)
    : 0;

  const channelCount: Record<string, number> = {};
  for (const e of allJournal) {
    channelCount[e.category] = (channelCount[e.category] || 0) + 1;
  }
  const channelData = Object.entries(channelCount)
    .filter(([_, count]) => count > 0)
    .map(([key, count]) => ({
      name: CATEGORY_META[key]?.label || key,
      value: count,
      color: CATEGORY_META[key]?.color || "#8B8FA3",
    }));

  const uniqueFollowUpTeens = new Set(followUps.map((e) => e.teenId));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Cobertura (30d)"
          value={`${coveragePct}%`}
          sub={`${teensWithRecentJournal.size}/${teens.length} jóvenes`}
          color="teal"
        />
        <KpiCard
          label="Registros totales"
          value={allJournal.length}
          sub={`${recentJournal.length} en últimos 30 días`}
          color="sage"
        />
        <KpiCard
          label="Requieren seguimiento"
          value={uniqueFollowUpTeens.size}
          sub="casos pendientes"
          color="coral"
        />
      </div>

      <div className="bg-white rounded-card shadow-soft p-5">
        <h2 className="font-display font-semibold text-base mb-4">
          Distribución por canal de contacto
        </h2>
        {channelData.length === 0 ? (
          <p className="text-sm text-ink/40 text-center py-8">
            Sin registros pastorales en este período
          </p>
        ) : (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {channelData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {channelData.map((e) => (
                <div key={e.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: e.color }} />
                  <span className="text-ink/70">{e.name}</span>
                  <span className="font-semibold ml-auto">{e.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    teal: "text-teal-700 bg-teal-50",
    sage: "text-sage-600 bg-sage-50",
    coral: "text-coral-600 bg-coral-50",
  };
  return (
    <div className="bg-white rounded-card shadow-soft p-4">
      <p className={`text-2xl font-bold font-display ${colors[color]?.split(" ")[0] || ""}`}>
        {value}
      </p>
      <p className="text-xs font-semibold text-ink/60 mt-0.5">{label}</p>
      <p className="text-[11px] text-ink/40">{sub}</p>
    </div>
  );
}
