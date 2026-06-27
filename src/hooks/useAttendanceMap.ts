import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { AttendanceMap } from "../lib/types";

export function useAttendanceMap(): AttendanceMap | undefined {
  const records = useQuery(api.attendance.list);

  if (!records) return undefined;

  const map: AttendanceMap = {};
  for (const r of records) {
    if (!map[r.date]) map[r.date] = {};
    map[r.date][r.teenId] = r.status;
  }
  return map;
}
