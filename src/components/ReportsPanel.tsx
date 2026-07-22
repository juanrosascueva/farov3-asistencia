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
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";
import AiPanel from "./AiPanel";

interface ReportsPanelProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
  initialTab?: Tab;
}

type Tab = "attendance" | "pastoral" | "levels" | "fichas" | "ia";
type Range = "30d" | "3m" | "all";

export default function ReportsPanel({ teens, attendanceMap, onOpenProfile, initialTab = "attendance" }: ReportsPanelProps) {
  const { canUseAi, token } = useAuth();
  const { scope, scopeLabel } = useScope();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [range, setRange] = useState<Range>("30d");
  const scopeArgs = { campusId: scope.campusId as any, ministryId: scope.ministryId as any, groupId: scope.groupId as any };
  const allJournal = useQuery(api.journal.listAll, token ? { token, ...scopeArgs } : "skip") ?? [];
  const followUps = useQuery(api.journal.listFollowUps, token ? { token, ...scopeArgs } : "skip") ?? [];
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
    ...(canUseAi ? [{ id: "ia" as Tab, label: "Tendencias IA", icon: "✦" }] : []),
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          Analíticas
        </p>
        <h1 className="font-display text-2xl font-bold mt-0.5">Analítica</h1>
        <p className="mt-1 text-sm text-ink/50">{scopeLabel}</p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5 sm:bg-ink/5 sm:rounded-xl sm:p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl transition whitespace-nowrap min-w-0 ${
                tab === t.id ? "bg-card shadow-sm text-ink border border-ink/5 sm:border-transparent" : "bg-ink/[0.03] text-ink/50 hover:text-ink sm:bg-transparent"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-1.5 sm:bg-ink/5 sm:rounded-xl sm:p-1">
          {([
            { id: "30d" as Range, label: "30 días" },
            { id: "3m" as Range, label: "3 meses" },
            { id: "all" as Range, label: "Todo" },
          ]).map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`text-xs font-semibold px-3 py-2 rounded-xl transition whitespace-nowrap min-w-0 ${
                range === r.id ? "bg-card shadow-sm text-ink border border-ink/5 sm:border-transparent" : "bg-ink/[0.03] text-ink/50 hover:text-ink sm:bg-transparent"
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
      {tab === "ia" && canUseAi && <AiPanel teens={teens} attendanceMap={attendanceMap} onOpenProfile={onOpenProfile} embedded />}
    </div>
  );
}
