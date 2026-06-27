import { useState, useCallback, createContext, useContext, useEffect } from "react";
import type { Leader } from "../lib/types";

const LEADERS_KEY = "faro_leaders_v1";
const CURRENT_LEADER_KEY = "faro_current_leader_v1";

function loadLeaders(): Leader[] {
  try {
    const data = localStorage.getItem(LEADERS_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  const defaults: Leader[] = [
    { id: "l1", name: "Juan Rosas", role: "pastor" },
    { id: "l2", name: "María Ortega", role: "teacher" },
  ];
  localStorage.setItem(LEADERS_KEY, JSON.stringify(defaults));
  return defaults;
}

function loadCurrentLeaderId(): string | null {
  try {
    return localStorage.getItem(CURRENT_LEADER_KEY);
  } catch {
    return null;
  }
}

interface LeaderContextValue {
  leaders: Leader[];
  currentLeader: Leader | null;
  currentLeaderId: string | null;
  addLeader: (name: string, role: Leader["role"]) => void;
  deleteLeader: (id: string) => void;
  setCurrentLeader: (id: string | null) => void;
}

export const LeaderContext = createContext<LeaderContextValue>(null!);

export function useLeaderContext() {
  return useContext(LeaderContext);
}

export function useLeaders(): LeaderContextValue {
  const [leaders, setLeaders] = useState<Leader[]>(loadLeaders);
  const [currentLeaderId, setCurrentLeaderId] = useState<string | null>(
    loadCurrentLeaderId
  );

  const saveLeaders = useCallback((newLeaders: Leader[]) => {
    setLeaders(newLeaders);
    localStorage.setItem(LEADERS_KEY, JSON.stringify(newLeaders));
  }, []);

  const addLeader = useCallback(
    (name: string, role: Leader["role"]) => {
      const newLeader: Leader = { id: "l_" + Date.now(), name, role };
      saveLeaders([...leaders, newLeader]);
    },
    [leaders, saveLeaders]
  );

  const deleteLeader = useCallback(
    (id: string) => {
      saveLeaders(leaders.filter((l) => l.id !== id));
      if (currentLeaderId === id) {
        setCurrentLeaderId(null);
        localStorage.removeItem(CURRENT_LEADER_KEY);
      }
    },
    [leaders, currentLeaderId, saveLeaders]
  );

  const setCurrentLeader = useCallback((id: string | null) => {
    setCurrentLeaderId(id);
    if (id) localStorage.setItem(CURRENT_LEADER_KEY, id);
    else localStorage.removeItem(CURRENT_LEADER_KEY);
  }, []);

  const currentLeader =
    leaders.find((l) => l.id === currentLeaderId) || null;

  return {
    leaders,
    currentLeader,
    currentLeaderId,
    addLeader,
    deleteLeader,
    setCurrentLeader,
  };
}
