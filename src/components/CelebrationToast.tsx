import { useEffect, useState } from "react";
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
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const colors = ["#6849FF", "#FF5A5F", "#FF9F1C", "#FFC43D", "#2F80ED", "#8066FF", "#38C793"];
    const temp: any[] = [];
    const count = 60;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 250;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - (40 + Math.random() * 80);
      const rot = Math.random() * 360 + 180;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dur = (1.4 + Math.random() * 1.2).toFixed(2) + "s";
      const br = Math.random() > 0.5 ? "50%" : "2px";
      const delay = (Math.random() * 0.15).toFixed(2) + "s";

      temp.push({ id: i, tx: `${tx}px`, ty: `${ty}px`, rot: `${rot}deg`, color, dur, br, delay });
    }
    setParticles(temp);

    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  const hasFire = streakTier && streakTier.icon;

  return (
    <>
      {/* Contenedor del confeti */}
      <div className="confetti-container">
        {particles.map((p: any) => (
          <div
            key={p.id}
            className="confetti-particle"
            style={
              {
                "--tx": p.tx,
                "--ty": p.ty,
                "--rot": p.rot,
                "--color": p.color,
                "--dur": p.dur,
                "--br": p.br,
                animationDelay: p.delay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div style={{ animation: "bounce-in 0.4s ease-out" }} className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50">
        <div className="bg-primary-600 text-white rounded-2xl shadow-xl px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4 w-full sm:min-w-[280px] sm:max-w-sm">
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
          <button onClick={onDone} className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:text-white pressable">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}
