import { useEffect } from "react";
import type { StreakTier, BadgeResult } from "../lib/types";

const styleId = "celebration-toast-styles";
if (!document.getElementById(styleId)) {
  const s = document.createElement("style");
  s.id = styleId;
  s.textContent = `@keyframes bounce-in{0%{opacity:0;transform:translateX(-50%) translateY(20px) scale(0.92)}50%{transform:translateX(-50%) translateY(-4px) scale(1.02)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}`;
  document.head.appendChild(s);
}

interface CelebrationToastProps {
  name: string;
  streakTier: StreakTier | null;
  newBadges: BadgeResult[];
  onDone: () => void;
}

export default function CelebrationToast({ name, streakTier, newBadges, onDone }: CelebrationToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  const hasFire = streakTier && streakTier.icon;

  return (
    <div style={{ animation: "bounce-in 0.4s ease-out" }} className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-ink text-white rounded-2xl shadow-xl px-5 py-4 flex items-center gap-4 min-w-[280px] max-w-sm">
        <div className="shrink-0 flex flex-col items-center">
          {newBadges.length > 0 ? (
            <span className="text-3xl">{newBadges[0].meta.icon}</span>
          ) : hasFire ? (
            <span className="text-3xl">🔥</span>
          ) : (
            <span className="text-3xl">⭐</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs text-white/70 leading-tight mt-0.5">
            {newBadges.length > 0
              ? `¡Nueva insignia: ${newBadges[0].meta.name}!`
              : hasFire
              ? `¡Racha de ${streakTier!.label}! ${streakTier!.icon}`
              : "¡Asistencia marcada!"}
          </p>
        </div>
        <button onClick={onDone} className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  );
}
