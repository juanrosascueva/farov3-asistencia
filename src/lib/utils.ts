import type { AttendanceMap, StatsResult, AlertInfo } from "./types";

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
  const lastStatuses: { date: string; status: string }[] = [];
  dates.forEach((d) => {
    const st = map[d]?.[teenId];
    if (!st) return;
    total++;
    if (st === "present") present++;
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
  return { total, present, pct, consecutiveAbsences, presentStreak, history: lastStatuses };
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
