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

export interface JournalAnalysis {
  entryId: string;
  teenId: string;
  vulnerabilityTags: string[];
  riskLevel: "low" | "medium" | "high";
  suggestedActions: string[];
  suggestedVerses: string[];
  summary: string;
  isCrisis?: boolean;
  analyzedAt: string;
  modelUsed: string;
}

export interface TeenSummary {
  teenId: string;
  summary: string;
  pastoralMomentum: string;
  mainChallenge: string;
  recommendedFocus: string;
  generatedAt: string;
  modelUsed: string;
}

export interface PriorityScore {
  teenId: string;
  score: number;
  label: string;
  factors: {
    riskScore: number;
    vulnerabilityLevel: number;
    contactRecency: number;
    consecutiveAbsences: number;
    journalRecency: number;
    hasFollowUp: boolean;
  };
}

export interface DropoutPrediction {
  teenId: string;
  probability: number;
  riskLevel: "low" | "medium" | "high";
  primaryFactor: string;
  recommendation: string;
  generatedAt: string;
  modelUsed: string;
}

export const VULNERABILITY_TAGS: { id: string; label: string; icon: string }[] = [
  { id: "salud_mental", label: "Salud Mental", icon: "🧠" },
  { id: "familiar", label: "Familiar", icon: "👪" },
  { id: "adiccion", label: "Adicción", icon: "⚠️" },
  { id: "duelo", label: "Duelo", icon: "🕊️" },
  { id: "espiritual", label: "Espiritual", icon: "🙏" },
  { id: "academico", label: "Académico", icon: "📚" },
  { id: "violencia", label: "Violencia", icon: "🚫" },
  { id: "relaciones", label: "Relaciones", icon: "💔" },
  { id: "fisico", label: "Salud Física", icon: "🏥" },
  { id: "economico", label: "Económico", icon: "💰" },
];

export interface RiskInfo {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
  action: string;
  color: "gray" | "teal" | "amber" | "coral" | "red";
  factors: {
    consecutiveAbsences: number;
    maturityScore: number;
  };
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

export interface MessageTemplate {
  id: string;
  name: string;
  category: "absence" | "streak" | "birthday" | "general";
  recipient: "teen" | "parent";
  text: string;
  emoji: string;
}
