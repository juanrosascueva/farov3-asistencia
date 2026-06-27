import { useState, useCallback } from "react";

const TARGET_KEY = "cristovive_pastoral_target_v1";

function loadTarget(): number {
  try {
    const data = localStorage.getItem(TARGET_KEY);
    if (data) {
      const n = Number(data);
      if (!isNaN(n)) return Math.min(100, Math.max(50, Math.round(n / 5) * 5));
    }
  } catch {}
  return 80;
}

export function usePastoralTarget() {
  const [pastoralTargetCoverage, setTargetState] = useState<number>(loadTarget);

  const setPastoralTargetCoverage = useCallback((v: number) => {
    const clamped = Math.min(100, Math.max(50, Math.round(v / 5) * 5));
    setTargetState(clamped);
    localStorage.setItem(TARGET_KEY, String(clamped));
  }, []);

  return { pastoralTargetCoverage, setPastoralTargetCoverage };
}
