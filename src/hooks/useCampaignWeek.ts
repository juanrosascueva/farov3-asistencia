import { useState, useCallback } from "react";

const WEEK_KEY = "cristovive_campaign_week_v1";

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function loadWeek(): string {
  try {
    const data = localStorage.getItem(WEEK_KEY);
    if (data) return data;
  } catch {}
  return getWeekStart(new Date());
}

export function useCampaignWeek() {
  const [currentWeek, setWeekState] = useState<string>(loadWeek);

  const setWeek = useCallback((iso: string) => {
    setWeekState(iso);
    localStorage.setItem(WEEK_KEY, iso);
  }, []);

  const goNextWeek = useCallback(() => {
    const d = new Date(currentWeek + "T00:00:00");
    d.setDate(d.getDate() + 7);
    const next = d.toISOString().slice(0, 10);
    setWeekState(next);
    localStorage.setItem(WEEK_KEY, next);
  }, [currentWeek]);

  const goPrevWeek = useCallback(() => {
    const d = new Date(currentWeek + "T00:00:00");
    d.setDate(d.getDate() - 7);
    const prev = d.toISOString().slice(0, 10);
    setWeekState(prev);
    localStorage.setItem(WEEK_KEY, prev);
  }, [currentWeek]);

  const goCurrentWeek = useCallback(() => {
    const now = getWeekStart(new Date());
    setWeekState(now);
    localStorage.setItem(WEEK_KEY, now);
  }, []);

  const weekLabel = useCallback(() => {
    const d = new Date(currentWeek + "T00:00:00");
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const fmt = (dt: Date) =>
      dt.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `${fmt(d)} – ${fmt(end)}`;
  }, [currentWeek]);

  const isCurrentWeek = getWeekStart(new Date()) === currentWeek;

  return { currentWeek, setWeek, goNextWeek, goPrevWeek, goCurrentWeek, weekLabel, isCurrentWeek };
}
