export type AttendanceStatus = "present" | "absent" | "excused";
export type AttendanceMap = Record<string, Record<string, AttendanceStatus | undefined>>;

export interface StatsResult {
  total: number;
  present: number;
  pct: number;
  consecutiveAbsences: number;
  presentStreak: number;
  history: { date: string; status: string }[];
}

export interface AlertInfo {
  level: "critical" | "urgent" | "check";
  label: string;
  action: string;
  color: "coral" | "amber" | "teal";
}
