export type AttendanceStatus = "present" | "absent" | "excused";
export type AttendanceMap = Record<string, Record<string, AttendanceStatus | undefined>>;

export interface StatsResult {
  total: number;
  present: number;
  excused: number;
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

export type BadgeId =
  | "first_attendance"
  | "bronze"
  | "silver"
  | "gold"
  | "perfect_month"
  | "comeback";

export interface BadgeMeta {
  id: BadgeId;
  name: string;
  icon: string;
  description: string;
  condition: string;
}

export interface BadgeResult {
  meta: BadgeMeta;
  unlocked: boolean;
  progress: number;
  goal: number;
}

export interface LevelInfo {
  level: number;
  name: string;
  xp: number;
  nextXp: number;
  progress: number;
}

export interface StreakTier {
  label: string;
  icon: string;
  color: string;
}

export interface GamificationResult {
  xp: number;
  level: LevelInfo;
  badges: BadgeResult[];
  streakTier: StreakTier | null;
}

export interface Leader {
  id: string;
  name: string;
  role: "pastor" | "teacher" | "leader" | "helper";
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: "absence" | "streak" | "birthday" | "general";
  recipient: "teen" | "parent";
  text: string;
  emoji: string;
}
