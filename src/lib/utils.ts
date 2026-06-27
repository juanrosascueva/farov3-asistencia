import type {
  AttendanceMap,
  StatsResult,
  AlertInfo,
  BadgeId,
  BadgeMeta,
  BadgeResult,
  LevelInfo,
  StreakTier,
  GamificationResult,
} from "./types";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function ageFromDOB(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const dob = new Date(iso + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function lastNSundays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() - dow);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() - 7 * i);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

export function allDatesSorted(map: AttendanceMap): string[] {
  return Object.keys(map).sort();
}

export function statsFor(
  teenId: string,
  map: AttendanceMap
): StatsResult {
  const dates = allDatesSorted(map);
  let total = 0;
  let present = 0;
  let excused = 0;
  const lastStatuses: { date: string; status: string }[] = [];
  dates.forEach((d) => {
    const st = map[d]?.[teenId];
    if (!st) return;
    total++;
    if (st === "present") present++;
    if (st === "excused") excused++;
    lastStatuses.push({ date: d, status: st });
  });
  let consecutiveAbsences = 0;
  for (let i = lastStatuses.length - 1; i >= 0; i--) {
    if (lastStatuses[i].status === "absent") consecutiveAbsences++;
    else break;
  }
  let presentStreak = 0;
  for (let i = lastStatuses.length - 1; i >= 0; i--) {
    if (lastStatuses[i].status === "present") presentStreak++;
    else break;
  }
  const pct = total ? Math.round((present / total) * 100) : 0;
  return { total, present, excused, pct, consecutiveAbsences, presentStreak, history: lastStatuses };
}

export function alertLevel(consecutiveAbsences: number): AlertInfo | null {
  if (consecutiveAbsences >= 3)
    return {
      level: "critical",
      label: "Alerta crítica",
      action: "Visita o seguimiento pastoral",
      color: "coral",
    };
  if (consecutiveAbsences === 2)
    return {
      level: "urgent",
      label: "Urgente",
      action: "Contactar / escribir con urgencia",
      color: "amber",
    };
  if (consecutiveAbsences === 1)
    return {
      level: "check",
      label: "Seguimiento",
      action: "Llamar para preguntar cómo está",
      color: "teal",
    };
  return null;
}

export function stringHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function esc(s: string | undefined | null): string {
  return (s || "")
    .toString()
    .replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || "")
    );
}

export function daysToNextBirthday(
  iso: string | undefined | null
): number | null {
  if (!iso) return null;
  const dob = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < now)
    next = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate());
  return Math.round((+next - +now) / 86400000);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

const BADGE_DEFS: BadgeMeta[] = [
  { id: "first_attendance", name: "Primeros Pasos", icon: "🚀", description: "Primera asistencia marcada", condition: "1 asistencia" },
  { id: "bronze", name: "Pionero Fiel", icon: "🥉", description: "Constancia bronce", condition: "4 asistencias" },
  { id: "silver", name: "Guardián del Grupo", icon: "🥈", description: "Constancia plata", condition: "12 asistencias" },
  { id: "gold", name: "Columna Fiel", icon: "🥇", description: "Constancia oro", condition: "24 asistencias" },
  { id: "perfect_month", name: "Mes Perfecto", icon: "📅", description: "Asistencia perfecta 4 semanas seguidas", condition: "4 presentes consecutivos" },
  { id: "comeback", name: "El Regreso", icon: "🔄", description: "Asistir tras alerta crítica", condition: "Regreso tras 3+ faltas" },
];

const STREAK_TIERS: Record<string, StreakTier> = {
  bronze: { label: "Bronce", icon: "🔥", color: "text-amber-700" },
  silver: { label: "Plata", icon: "🔥⚡", color: "text-slate-500" },
  gold: { label: "Oro", icon: "🔥🌟", color: "text-yellow-600" },
  diamond: { label: "Diamante", icon: "💎🔥", color: "text-cyan-600" },
};

const LEVELS: { min: number; max: number; name: string }[] = [
  { min: 0, max: 499, name: "Iniciado" },
  { min: 500, max: 1499, name: "Fiel" },
  { min: 1500, max: 2999, name: "Líder en Potencia" },
  { min: 3000, max: Infinity, name: "Mentor Juvenil" },
];

export function calculateXP(total: number, presentStreak: number, excused: number): number {
  return total * 100 + presentStreak * 50 + excused * 20;
}

export function getLevel(xp: number): LevelInfo {
  for (const l of LEVELS) {
    if (xp >= l.min && xp <= l.max) {
      const nextMin = LEVELS.find((x) => x.min > l.min);
      const nextXp = nextMin ? nextMin.min : l.max;
      const range = nextXp - l.min;
      const progress = range > 0 ? Math.min(1, (xp - l.min) / range) : 1;
      return { level: LEVELS.indexOf(l) + 1, name: l.name, xp, nextXp, progress };
    }
  }
  return { level: 4, name: "Mentor Juvenil", xp, nextXp: xp, progress: 1 };
}

export function streakTier(presentStreak: number): StreakTier | null {
  if (presentStreak >= 12) return STREAK_TIERS.diamond;
  if (presentStreak >= 8) return STREAK_TIERS.gold;
  if (presentStreak >= 4) return STREAK_TIERS.silver;
  if (presentStreak >= 2) return STREAK_TIERS.bronze;
  return null;
}

export function calculateBadges(stats: StatsResult, history: { date: string; status: string }[]): BadgeResult[] {
  const hadCriticalAlert = history.some((h, i) => {
    if (h.status !== "absent") return false;
    let count = 1;
    for (let j = i - 1; j >= 0 && history[j].status === "absent"; j--) count++;
    return count >= 3;
  });
  const lastPresentAfterAlert = hadCriticalAlert && history.length > 0 && history[history.length - 1].status === "present";

  const conditions: Record<BadgeId, { progress: number; goal: number }> = {
    first_attendance: { progress: Math.min(1, stats.total), goal: 1 },
    bronze: { progress: Math.min(4, stats.total), goal: 4 },
    silver: { progress: Math.min(12, stats.total), goal: 12 },
    gold: { progress: Math.min(24, stats.total), goal: 24 },
    perfect_month: { progress: Math.min(4, stats.presentStreak), goal: 4 },
    comeback: { progress: lastPresentAfterAlert ? 1 : 0, goal: 1 },
  };

  return BADGE_DEFS.map((meta) => ({
    meta,
    unlocked: conditions[meta.id].progress >= conditions[meta.id].goal,
    progress: conditions[meta.id].progress,
    goal: conditions[meta.id].goal,
  }));
}

export function getGamification(stats: StatsResult): GamificationResult {
  const xp = calculateXP(stats.total, stats.presentStreak, stats.excused);
  return {
    xp,
    level: getLevel(xp),
    badges: calculateBadges(stats, stats.history),
    streakTier: streakTier(stats.presentStreak),
  };
}

export function downloadFile(
  filename: string,
  content: string,
  type: string
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
