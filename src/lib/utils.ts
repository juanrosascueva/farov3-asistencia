import type {
  AttendanceMap,
  StatsResult,
  RiskInfo,
  BadgeId,
  BadgeMeta,
  BadgeResult,
  LevelInfo,
  StreakTier,
  GamificationResult,
  TeenProfileCompleteness,
  TeenStatus,
  SpiritualStage,
} from "./types";

export const TEEN_STATUS_META: Record<TeenStatus, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-success-50 text-success-700 border-success-100" },
  visitante: { label: "Visitante", cls: "bg-info-50 text-info-700 border-info-100" },
  nuevo: { label: "Nuevo", cls: "bg-primary-50 text-primary-700 border-primary-100" },
  seguimiento: { label: "Seguimiento", cls: "bg-warning-50 text-warning-700 border-warning-100" },
  inactivo: { label: "Inactivo", cls: "bg-neutral-100 text-neutral-700 border-neutral-200" },
  trasladado: { label: "Trasladado", cls: "bg-primary-50 text-primary-700 border-primary-100" },
  archivado: { label: "Archivado", cls: "bg-neutral-100 text-neutral-500 border-neutral-200" },
  eliminado: { label: "Eliminado", cls: "bg-danger-50 text-danger-700 border-danger-100" },
  egresado: { label: "Egresado", cls: "bg-info-50 text-info-700 border-info-100" },
};

export const SPIRITUAL_STAGE_LABELS: Record<SpiritualStage, string> = {
  nuevo: "Nuevo",
  conociendo: "Conociendo a Cristo",
  afirmando_fe: "Afirmando su fe",
  bautizado: "Bautizado",
  sirviendo: "Sirviendo",
};

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

export function riskScore(stats: StatsResult): RiskInfo {
  if (stats.total === 0)
    return { score: 0, label: "Sin datos", action: "—", color: "gray", factors: { consecutiveAbsences: 0, maturityScore: 0 } };
  const I = Math.min(stats.consecutiveAbsences, 4);
  let M = 0;
  if (stats.pct >= 80) M = 0;
  else if (stats.pct >= 60) M = 1;
  else if (stats.pct >= 40) M = 2;
  else if (stats.pct >= 20) M = 3;
  else M = 4;

  // Suavizado para evitar falsos positivos de riesgo crítico/crisis cuando hay muy pocos registros
  if (stats.total < 4) {
    const scale = stats.total / 4;
    M = Math.round(M * scale);
  }

  const raw = I + M;
  const score = Math.min(5, Math.max(0, raw)) as 0 | 1 | 2 | 3 | 4 | 5;
  const levels: Record<number, { label: string; action: string; color: RiskInfo["color"] }> = {
    0: { label: "Sin riesgo", action: "—", color: "gray" },
    1: { label: "Seguimiento preventivo", action: "Llamada de contacto amistosa", color: "teal" },
    2: { label: "Atención moderada", action: "Conversación personal", color: "amber" },
    3: { label: "Urgente", action: "Contactar con los padres", color: "coral" },
    4: { label: "Crítico", action: "Visita domiciliaria pastoral", color: "red" },
    5: { label: "Crisis", action: "Intervención inmediata: visita + equipo pastoral", color: "red" },
  };
  const l = levels[score];
  return { score, label: l.label, action: l.action, color: l.color, factors: { consecutiveAbsences: stats.consecutiveAbsences, maturityScore: M } };
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

export function normalizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\-\s]/g, "").replace(/\s+/g, " ").trimStart();
}

export function phoneDigits(value: string | undefined | null): string {
  return (value || "").replace(/\D/g, "");
}

export function getPrimaryGuardianName(teen: Record<string, any>): string {
  return teen.nombreEncargado || teen.parentescoEncargado || "Sin encargado";
}

export function getTeenStatus(teen: Record<string, any>): TeenStatus {
  return (teen.estado as TeenStatus | undefined) || "activo";
}

export function getTeenContactWarnings(teen: Record<string, any>): string[] {
  const warnings: string[] = [];
  if (teen.fichaCompleta === false || teen.registroRapido) warnings.push("Ficha incompleta");
  if (!teen.nombreEncargado) warnings.push("Sin nombre de tutor");
  if (!teen.telefonoPadre && !teen.contactoEmergenciaTelefono) warnings.push("Sin contacto familiar");
  if (!teen.telefono && !teen.telefonoPadre) warnings.push("Sin teléfonos");
  if (!teen.campusId) warnings.push("Sin asignación pastoral");
  if (!teen.consentimientoDatos) warnings.push("Sin consentimiento de datos");
  return warnings;
}

export function teenProfileCompleteness(teen: Record<string, any>): TeenProfileCompleteness {
  if (teen.registroRapido && teen.fichaCompleta === false) {
    const requiredQuick: Array<[string, boolean]> = [
      ["Nombre", !!teen.nombre],
      ["Contacto", !!(teen.telefono || teen.telefonoPadre || teen.contactoEmergenciaTelefono)],
      ["Sede", !!teen.campusId],
      ["Observación inicial", !!teen.observacionInicial],
    ];
    const completedQuick = requiredQuick.filter(([, ok]) => ok).length;
    return {
      percent: Math.round((completedQuick / requiredQuick.length) * 100),
      completed: completedQuick,
      total: requiredQuick.length,
      missing: requiredQuick.filter(([, ok]) => !ok).map(([label]) => label),
    };
  }
  const required: Array<[string, boolean]> = [
    ["Nombre", !!teen.nombre],
    ["Apellido", !!teen.apellido],
    ["Fecha de nacimiento", !!teen.nacimiento],
    ["Teléfono del adolescente", !!teen.telefono],
    ["Nombre del encargado", !!teen.nombreEncargado],
    ["Teléfono del encargado", !!teen.telefonoPadre],
    ["Parentesco del encargado", !!teen.parentescoEncargado],
    ["Fecha de ingreso", !!teen.fechaIngreso],
    ["Estado", !!teen.estado],
    ["Sede", !!teen.campusId],
    ["Consentimiento de datos", teen.consentimientoDatos === true],
  ];
  const completed = required.filter(([, ok]) => ok).length;
  const total = required.length;
  return {
    percent: Math.round((completed / total) * 100),
    completed,
    total,
    missing: required.filter(([, ok]) => !ok).map(([label]) => label),
  };
}

export function createTeenCsvTemplate(): string {
  const headers = [
    "nombre",
    "apellido",
    "nacimiento",
    "sexo",
    "telefono",
    "telefonoPadre",
    "telefonoSecundario",
    "nombreEncargado",
    "parentescoEncargado",
    "contactoEmergenciaNombre",
    "contactoEmergenciaTelefono",
    "permiteMensajes",
    "gustos",
    "observacionInicial",
    "fechaIngreso",
    "estado",
    "motivoInactividad",
    "colegio",
    "gradoEscolar",
    "barrio",
    "viveCon",
    "decisionEspiritual",
    "requiereSeguimientoEspecial",
    "consentimientoDatos",
    "consentimientoFoto",
    "fechaConsentimiento",
  ];
  const sample = [
    "Samuel",
    "Perez",
    "2010-05-14",
    "masculino",
    "809-555-0101",
    "809-555-0102",
    "",
    "Rosa Perez",
    "Madre",
    "Carlos Perez",
    "809-555-0103",
    "si",
    "musica; dibujo",
    "Llega invitado por un amigo del grupo.",
    todayISO(),
    "activo",
    "",
    "Colegio Esperanza",
    "2do secundaria",
    "Villa Nueva",
    "Madre y abuela",
    "conociendo",
    "no",
    "si",
    "si",
    todayISO(),
  ];
  return `${headers.join(",")}\n${sample.map(csvEscape).join(",")}\n`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
  bronze: { label: "Bronce", icon: "🔥", color: "text-warning-700" },
  silver: { label: "Plata", icon: "🔥⚡", color: "text-neutral-500" },
  gold: { label: "Oro", icon: "🔥🌟", color: "text-yellow-600" },
  diamond: { label: "Diamante", icon: "💎🔥", color: "text-info-600" },
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
