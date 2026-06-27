import type { LevelInfo } from "../lib/types";

interface XpBarProps {
  level: LevelInfo;
}

export default function XpBar({ level }: XpBarProps) {
  return (
    <div className="bg-white rounded-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center text-white text-xs font-bold">
            {level.level}
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Nivel {level.level}</p>
            <p className="text-[11px] text-ink/45 leading-tight">{level.name}</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-ink/50 font-mono">
          {level.xp} XP
        </span>
      </div>
      <div className="w-full h-2 bg-ink/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-amber-500 transition-all"
          style={{ width: `${Math.round(level.progress * 100)}%` }}
        />
      </div>
      {level.xp < level.nextXp && (
        <p className="text-[11px] text-ink/40 mt-1.5 text-right">
          {level.xp} / {level.nextXp} XP para nivel {level.level + 1}
        </p>
      )}
    </div>
  );
}
