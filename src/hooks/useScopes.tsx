import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "./useAuth";
import { useMemo } from "react";

export function useScopes() {
  const { token, user } = useAuth();
  const myScopes = useQuery(api.userScopes.myScopes, token ? { token } : "skip");

  const isGlobal = user?.role === "pastor" || user?.role === "admin" || user?.role === "director";

  const accessibleCampusIds = useMemo(() => {
    if (!myScopes) return [];
    return [...new Set(myScopes.filter(s => s.campusId).map(s => s.campusId!))];
  }, [myScopes]);

  const accessibleMinistryIds = useMemo(() => {
    if (!myScopes) return [];
    return [...new Set(myScopes.filter(s => s.ministryId).map(s => s.ministryId!))];
  }, [myScopes]);

  const accessibleGroupIds = useMemo(() => {
    if (!myScopes) return [];
    return [...new Set(myScopes.filter(s => s.groupId).map(s => s.groupId!))];
  }, [myScopes]);

  const filterCampuses = (campuses: any[] | undefined) => {
    if (!campuses) return [];
    if (isGlobal) return campuses;
    return campuses.filter(c => accessibleCampusIds.includes(c._id));
  };

  const filterMinistries = (ministries: any[] | undefined, selectedCampusId: string) => {
    if (!ministries) return [];
    if (isGlobal) return ministries;
    
    // Si el usuario tiene un scope para este campus ENTERO (sin ministryId específico)
    const hasFullCampusAccess = myScopes?.some(s => s.campusId === selectedCampusId && !s.ministryId && !s.groupId);
    if (hasFullCampusAccess) return ministries;

    // Si no, solo puede ver los ministerios a los que fue asignado explícitamente
    return ministries.filter(m => accessibleMinistryIds.includes(m._id));
  };

  const filterGroups = (groups: any[] | undefined, selectedCampusId: string, selectedMinistryId: string) => {
    if (!groups) return [];
    if (isGlobal) return groups;

    // Acceso total al campus
    const hasFullCampusAccess = myScopes?.some(s => s.campusId === selectedCampusId && !s.ministryId && !s.groupId);
    if (hasFullCampusAccess) return groups;

    // Acceso total al ministerio
    const hasFullMinistryAccess = myScopes?.some(s => s.ministryId === selectedMinistryId && !s.groupId);
    if (hasFullMinistryAccess) return groups;

    // Acceso específico a grupos
    return groups.filter(g => accessibleGroupIds.includes(g._id));
  };

  return {
    isGlobal,
    myScopes,
    isLoading: myScopes === undefined,
    filterCampuses,
    filterMinistries,
    filterGroups,
  };
}
