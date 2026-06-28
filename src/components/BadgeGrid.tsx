import type { BadgeResult } from "../lib/types";

interface BadgeGridProps {
  badges: BadgeResult[];
}

export default function BadgeGrid({ badges }: BadgeGridProps) {
  const unlocked = badges.filter((b) => b.unlocked);
  const locked = badges.filter((b) => !b.unlocked);

  return (
    <div className="bg-card rounded-card shadow-soft p-5">
      <h2 className="font-display font-semibold text-base mb-4">
        Insignias {unlocked.length > 0 && <span className="text-ink/40 font-normal">· {unlocked.length}/{badges.length}</span>}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {badges.map((b) => (
          <div
            key={b.meta.id}
            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition ${
              b.unlocked
                ? "bg-teal-50/50 border-teal-200"
                : "bg-ink/[0.02] border-ink/5 opacity-45"
            }`}
            title={b.unlocked ? b.meta.description : `${b.progress}/${b.goal} - ${b.meta.condition}`}
          >
            <span className="text-2xl leading-none">{b.meta.icon}</span>
            <p className={`text-[10px] font-semibold leading-tight ${b.unlocked ? "text-ink" : "text-ink/50"}`}>
              {b.meta.name}
            </p>
            {!b.unlocked && b.goal > 1 && (
              <div className="w-full h-1 bg-ink/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400/60 rounded-full"
                  style={{ width: `${Math.round((b.progress / b.goal) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
