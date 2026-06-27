import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../../lib/types";
import { statsFor, getGamification } from "../../lib/utils";

interface Props {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
}

const BADGE_NAMES: Record<string, string> = {
  first_attendance: "🚀 Primeros Pasos",
  bronze: "🥉 Pionero Fiel",
  silver: "🥈 Guardián del Grupo",
  gold: "🥇 Columna Fiel",
  perfect_month: "📅 Mes Perfecto",
  comeback: "🔄 El Regreso",
};

export default function GamificationStats({ teens, attendanceMap }: Props) {
  const all = teens.map((t) => {
    const s = statsFor(t._id, attendanceMap);
    return { teen: t, stats: s, game: getGamification(s) };
  });

  const levelCount = [0, 0, 0, 0];
  for (const x of all) {
    const idx = x.game.level.level - 1;
    if (idx >= 0 && idx < 4) levelCount[idx]++;
  }
  const levelData = [
    { name: "Nivel 1\nIniciado", value: levelCount[0] },
    { name: "Nivel 2\nFiel", value: levelCount[1] },
    { name: "Nivel 3\nLíder", value: levelCount[2] },
    { name: "Nivel 4\nMentor", value: levelCount[3] },
  ];

  const badgeCount: Record<string, number> = {};
  for (const x of all) {
    for (const b of x.game.badges) {
      if (b.unlocked) {
        badgeCount[b.meta.id] = (badgeCount[b.meta.id] || 0) + 1;
      }
    }
  }
  const badgeData = Object.entries(badgeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      name: BADGE_NAMES[id] || id,
      value: count,
    }));

  const totalXp = all.reduce((a, x) => a + x.game.xp, 0);
  const avgXp = all.length ? Math.round(totalXp / all.length) : 0;
  const highLevel = all.filter((x) => x.game.level.level >= 3).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="XP total del grupo" value={totalXp.toLocaleString()} sub={`promedio ${avgXp} por joven`} color="teal" />
        <KpiCard label="Nivel 3+ (Líderes)" value={highLevel} sub={`de ${teens.length} adolescentes`} color="amber" />
        <KpiCard label="Total insignias" value={badgeData.reduce((a, x) => a + x.value, 0)} sub="desbloqueadas" color="sage" />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white rounded-card shadow-soft p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Distribución de niveles
          </h2>
          {all.length === 0 ? (
            <p className="text-sm text-ink/40 text-center py-8">Sin datos</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={levelData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#0B7285" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-card shadow-soft p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Insignias más desbloqueadas
          </h2>
          {badgeData.length === 0 ? (
            <p className="text-sm text-ink/40 text-center py-8">Sin insignias aún</p>
          ) : (
            <div className="space-y-3">
              {badgeData.map((b) => (
                <div key={b.name} className="flex items-center gap-3">
                  <span className="text-sm w-6 text-center">{b.name.slice(0, 2)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-0.5">
                      <span className="text-ink/70 text-xs">{b.name}</span>
                      <span className="font-semibold text-xs">{b.value}</span>
                    </div>
                    <div className="w-full h-1.5 bg-ink/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-teal-600"
                        style={{ width: `${Math.round((b.value / teens.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    teal: "text-teal-700 bg-teal-50",
    sage: "text-sage-600 bg-sage-50",
    amber: "text-amber-600 bg-amber-50",
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
