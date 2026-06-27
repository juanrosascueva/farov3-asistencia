import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../../lib/types";
import { fmtDateShort } from "../../lib/utils";

interface Props {
  teens: Doc<"teens">[];
  filteredDates: string[];
  attendanceMap: AttendanceMap;
}

export default function AttendanceCharts({ teens, filteredDates, attendanceMap }: Props) {
  const trendData = filteredDates.map((d) => {
    const day = attendanceMap[d] || {};
    const vals = Object.values(day);
    const total = vals.length;
    const present = vals.filter((v) => v === "present").length;
    return {
      date: fmtDateShort(d),
      pct: total ? Math.round((present / total) * 100) : 0,
      present,
      total,
    };
  });

  const numTeens = teens.length;
  const last4 = filteredDates.slice(-4);
  let retained = 0;
  for (const t of teens) {
    const attended = last4.filter((d) => {
      const day = attendanceMap[d];
      return day?.[t._id] === "present";
    }).length;
    if (attended >= 3) retained++;
  }
  const retentionRate = last4.length && numTeens ? Math.round((retained / numTeens) * 100) : 0;

  let totalAbsences = 0;
  let totalExcused = 0;
  for (const d of filteredDates) {
    const day = attendanceMap[d] || {};
    for (const st of Object.values(day)) {
      if (st === "absent") totalAbsences++;
      if (st === "excused") totalExcused++;
    }
  }
  const totalMarks = totalAbsences + totalExcused;
  const excusedPct = totalMarks ? Math.round((totalExcused / totalMarks) * 100) : 0;

  const avgPresent = trendData.length
    ? Math.round(trendData.reduce((a, x) => a + x.present, 0) / trendData.length)
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Promedio semanal" value={avgPresent} sub={`de ${numTeens} adolescentes`} color="teal" />
        <KpiCard label="Retención (4 sem)" value={`${retentionRate}%`} sub={`${retained}/${numTeens} jóvenes`} color="sage" />
        <KpiCard label="Justificaciones" value={`${excusedPct}%`} sub={`${totalExcused} de ${totalMarks} faltas`} color="amber" />
      </div>

      <div className="bg-white rounded-card shadow-soft p-5">
        <h2 className="font-display font-semibold text-base mb-4">Tendencia de asistencia</h2>
        {trendData.length === 0 ? (
          <p className="text-sm text-ink/40 text-center py-8">Sin datos en este período</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 13, borderRadius: 12, border: "1px solid #e2e8f0" }}
                  formatter={(v: number) => [`${v}%`, "Asistencia"]}
                />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="#0B7285"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#0B7285" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
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
    amber: "text-amber-600 bg-amber-50",
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
