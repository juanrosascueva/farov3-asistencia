import { useState, createContext, useContext, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./useAuth";

export interface ActiveScope {
  campusId?: string;
  campusName?: string;
  ministryId?: string;
  ministryName?: string;
  groupId?: string;
  groupName?: string;
}

interface ScopeContextValue {
  scope: ActiveScope;
  setScope: (scope: ActiveScope) => void;
  canViewAll: boolean;
  scopeLabel: string;
}

const ScopeContext = createContext<ScopeContextValue>(null!);

export function useScope() {
  return useContext(ScopeContext);
}

const SCOPE_KEY = "cristovive_active_scope";

function loadScope(): ActiveScope {
  try {
    const data = localStorage.getItem(SCOPE_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return {};
}

function saveScope(scope: ActiveScope) {
  localStorage.setItem(SCOPE_KEY, JSON.stringify(scope));
}

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [scope, setScopeState] = useState<ActiveScope>(loadScope);

  const campuses = useQuery(api.campus.list, token ? { token } : "skip");
  const ministries = useQuery(
    api.ministry.list,
    token && scope.campusId ? { token, campusId: scope.campusId as any } : "skip"
  );
  const groups = useQuery(
    api.group.list,
    token && scope.ministryId ? { token, ministryId: scope.ministryId as any } : "skip"
  );

  const setScope = useCallback((newScope: ActiveScope) => {
    setScopeState(newScope);
    saveScope(newScope);
  }, []);

  const canViewAll = user?.role === "pastor" || !scope.campusId;

  const scopeLabel = useMemo(() => {
    if (!scope.campusId) return "Toda la iglesia";
    let label = scope.campusName || "Sede";
    if (scope.ministryName) label += ` / ${scope.ministryName}`;
    if (scope.groupName) label += ` / ${scope.groupName}`;
    return label;
  }, [scope]);

  const value = useMemo(() => ({
    scope,
    setScope,
    canViewAll,
    scopeLabel,
  }), [scope, setScope, canViewAll, scopeLabel]);

  return (
    <ScopeContext.Provider value={value}>
      {children}
    </ScopeContext.Provider>
  );
}
