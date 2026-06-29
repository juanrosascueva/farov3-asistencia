import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { allDatesSorted, statsFor, getGamification } from "../lib/utils";
import AttendanceCharts from "./reports/AttendanceCharts";
import PastoralStats from "./reports/PastoralStats";
import GamificationStats from "./reports/GamificationStats";
import RegistryStats from "./reports/RegistryStats";
import { usePastoralTarget } from "../hooks/usePastoralTarget";

interface ReportsPanelProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
}

type Tab = "attendance" | "pastoral" | "levels" | "fichas";
type Range = "30d" | "3m" | "all";

export default function ReportsPanel({ teens, attendanceMap }: ReportsPanelProps) {
  const [tab, setTab] = useState<Tab>("attendance");
  const [range, setRange] = useState<Range>("30d");
  const allJournal = useQuery(api.journal.listAll) ?? [];
  const followUps = useQuery(api.journal.listFollowUps) ?? [];
  const { pastoralTargetCoverage } = usePastoralTarget();

  const dates = allDatesSorted(attendanceMap);
  const now = new Date();
  const rangeCutoff = (() => {
    if (range === "30d") return new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    if (range === "3m") return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    return dates[0] || "";
  })();
  const filteredDates = dates.filter((d) => d >= rangeCutoff);

  const filteredMap: AttendanceMap = {};
  for (const d of filteredDates) {
    filteredMap[d] = attendanceMap[d] || {};
  }

  const filteredJournal = allJournal.filter((e) => e.entryDate >= rangeCutoff);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "attendance", label: "Asistencia", icon: "📊" },
    { id: "pastoral", label: "Pastoral", icon: "📋" },
    { id: "levels", label: "Niveles", icon: "🏆" },
    { id: "fichas", label: "Fichas", icon: "🗂️" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Analíticas
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">Reportes</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 bg-ink/5 rounded-xl p-1 overflow-x-auto w-full sm:w-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 ${
                tab === t.id ? "bg-card shadow-sm text-ink" : "text-ink/50 hover:text-ink"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-ink/5 rounded-xl p-1 overflow-x-auto w-full sm:w-auto">
          {([
            { id: "30d" as Range, label: "30 días" },
            { id: "3m" as Range, label: "3 meses" },
            { id: "all" as Range, label: "Todo" },
          ]).map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0 ${
                range === r.id ? "bg-card shadow-sm text-ink" : "text-ink/50 hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "attendance" && (
        <AttendanceCharts teens={teens} filteredDates={filteredDates} attendanceMap={filteredMap} />
      )}
      {tab === "pastoral" && (
        <PastoralStats
          teens={teens}
          allJournal={filteredJournal}
          followUps={followUps}
          pastoralTargetCoverage={pastoralTargetCoverage}
        />
      )}
      {tab === "levels" && (
        <GamificationStats teens={teens} attendanceMap={attendanceMap} />
      )}
      {tab === "fichas" && <RegistryStats teens={teens} />}
    </div>
  );
}
