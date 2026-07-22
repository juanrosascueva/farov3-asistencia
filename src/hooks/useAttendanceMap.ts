import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AttendanceMap } from "../lib/types";
import { useAuth } from "./useAuth";
import { useScope } from "./useScope";

export function useAttendanceMap(): AttendanceMap | undefined {
  const { token } = useAuth();
  const { scope } = useScope();
  const records = useQuery(api.attendance.list, token ? {
    token,
    campusId: scope.campusId as any,
    ministryId: scope.ministryId as any,
    groupId: scope.groupId as any,
  } : {});

  if (!records) return undefined;

  const map: AttendanceMap = {};
  for (const r of records) {
    if (!map[r.date]) map[r.date] = {};
    map[r.date][r.teenId] = r.status;
  }
  return map;
}
