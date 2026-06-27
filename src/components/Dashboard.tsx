import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import {
  greeting,
  fmtDateShort,
  statsFor,
  alertLevel,
  esc,
} from "../lib/utils";
import { Avatar } from "./Layout";

interface DashboardProps {
  teens: Doc<"teens">[];
  attendanceMap: AttendanceMap;
  onOpenProfile: (id: string) => void;
}

export default function Dashboard({
  teens,
  attendanceMap,
  onOpenProfile,
}: DashboardProps) {
  const dates = Object.keys(attendanceMap).sort();
  const currentWeek = dates[dates.length - 1];
  const all = teens.map((t) => ({ t, s: statsFor(t._id, attendanceMap) }));
  const avgPct = all.length
    ? Math.round(all.reduce((a, x) => a + x.s.pct, 0) / all.length)
    : 0;
  const weekPresent = currentWeek
    ? Object.values(attendanceMap[currentWeek] || {}).filter(
        (v) => v === "present"
      ).length
    : 0;
  const weekTotal = currentWeek
    ? Object.keys(attendanceMap[currentWeek] || {}).length
    : 0;

  const alerts = all
    .map((x) => ({ ...x, alert: alertLevel(x.s.consecutiveAbsences) }))
    .filter((x) => x.alert)
    .sort((a, b) => b.s.consecutiveAbsences - a.s.consecutiveAbsences);

  const streaks = all
    .filter((x) => x.s.presentStreak >= 3)
    .sort((a, b) => b.s.presentStreak - a.s.presentStreak);

  const trendDates = dates.slice(-8);
  const trend = trendDates.map((d) => {
    const vals = Object.values(attendanceMap[d] || {});
    const tot = vals.length;
    const pres = vals.filter((v) => v === "present").length;
    return { d, pct: tot ? Math.round((pres / tot) * 100) : 0 };
  });

  const colorMap: Record<string, string> = {
    ink: "text-ink bg-ink/5",
    teal: "text-teal-700 bg-teal-50",
    sage: "text-sage-600 bg-sage-50",
    coral: "text-coral-600 bg-coral-50",
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-teal-700 tracking-wide uppercase">
          {greeting()}
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mt-0.5">
          Resumen del ministerio
        </h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Adolescentes"
          value={teens.length}
          icon="users"
          color="ink"
          colorMap={colorMap}
        />
        <StatCard
          label="Asistencia promedio"
          value={avgPct + "%"}
          icon="check"
          color="teal"
          colorMap={colorMap}
        />
        <StatCard
          label="Esta semana"
          value={weekTotal ? `${weekPresent}/${weekTotal}` : "—"}
          icon="home"
          color="sage"
          colorMap={colorMap}
        />
        <StatCard
          label="Alertas activas"
          value={alerts.length}
          icon="alert"
          color={alerts.length ? "coral" : "ink"}
          colorMap={colorMap}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-card shadow-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-base">
              Alertas de seguimiento
            </h2>
            <span className="text-xs text-ink/40">
              {alerts.length} pendiente{alerts.length === 1 ? "" : "s"}
            </span>
          </div>
          {alerts.length === 0 ? (
            <EmptyState
              title="Sin alertas por ahora"
              sub="Todos los adolescentes están asistiendo con regularidad. Buen trabajo pastoreando esta semana."
            />
          ) : (
            <div className="space-y-2.5">
              {alerts.map((a) => (
                <AlertRow
                  key={a.t._id}
                  teen={a.t}
                  alert={a.alert!}
                  stats={a.s}
                  onOpenProfile={onOpenProfile}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-card shadow-soft p-5">
          <h2 className="font-display font-semibold text-base mb-4">
            Rachas activas
          </h2>
          {streaks.length === 0 ? (
            <EmptyState
              title="Aún sin rachas"
              sub="Cuando un adolescente asista 3 semanas seguidas aparecerá aquí."
            />
          ) : (
            <div className="space-y-3">
              {streaks.slice(0, 6).map((s) => (
                <div
                  key={s.t._id}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => onOpenProfile(s.t._id)}
                >
                  <Avatar teen={s.t} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {esc(s.t.nombre)} {esc(s.t.apellido)}
                    </p>
                    <p className="text-xs text-ink/45">{s.s.pct}% de asistencia</p>
                  </div>
                  <span className="chip text-xs font-semibold text-amber-600">
                    <FlameIcon />
                    {s.s.presentStreak}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-card shadow-soft p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-base">
            Tendencia de asistencia
          </h2>
          <span className="text-xs text-ink/40">
            Últimas {trend.length} semanas
          </span>
        </div>
        {trend.length === 0 ? (
          <EmptyState
            title="Sin datos todavía"
            sub="Marca la primera asistencia para ver la tendencia aquí."
          />
        ) : (
          <div className="flex items-end gap-2 h-36">
            {trend.map((p, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-2 group"
              >
                <div className="w-full flex items-end h-28 rounded-md bg-ink/[0.04] overflow-hidden relative">
                  <div
                    className="w-full bg-teal-600/85 group-hover:bg-teal-700 transition-all rounded-t-sm"
                    style={{ height: `${p.pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-ink/40">
                  {fmtDateShort(p.d)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  colorMap,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  colorMap: Record<string, string>;
}) {
  const icons: Record<string, string> = {
    home: `<path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1v-9"/>`,
    check: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8.5 14.5l2 2 4-4"/>`,
    users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3"/>`,
    alert: `<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>`,
  };
  return (
    <div className="bg-white rounded-card shadow-soft p-4">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colorMap[color] || ""}`}
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: icons[icon] || "" }}
        />
      </div>
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="text-xs text-ink/45 mt-1">{label}</p>
    </div>
  );
}

function AlertRow({
  teen,
  alert: al,
  stats: s,
  onOpenProfile,
}: {
  teen: Doc<"teens">;
  alert: NonNullable<ReturnType<typeof alertLevel>>;
  stats: ReturnType<typeof statsFor>;
  onOpenProfile: (id: string) => void;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    coral: "bg-coral-50 text-coral-600 border-coral-100",
  };
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${colorMap[al.color]} cursor-pointer`}
      onClick={() => onOpenProfile(teen._id)}
    >
      <Avatar teen={teen} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">
          {esc(teen.nombre)} {esc(teen.apellido)}
        </p>
        <p className="text-xs opacity-80">{al.action}</p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {al.label}
        </span>
        <p className="text-[11px] opacity-70">
          {s.consecutiveAbsences} falta
          {s.consecutiveAbsences === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div className="text-center py-8 px-4">
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
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4M16 2v4M3 10h18" />
          <path d="M8.5 14.5l2 2 4-4" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink/70">{title}</p>
      <p className="text-xs text-ink/40 mt-1 max-w-xs mx-auto">{sub}</p>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2c1 3-3 4-3 8a3 3 0 006 0c0-1-.3-1.7-.6-2.4.9.6 1.6 1.7 1.6 3.4 0 2.8-1.8 5-4 5s-5-2.5-5-6c0-3.5 2-6.6 5-8z" />
    </svg>
  );
}
