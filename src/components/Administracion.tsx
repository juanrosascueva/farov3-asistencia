import { useState } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import type { AttendanceMap } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import Ajustes from "./Ajustes";
import AccessControl from "./AccessControl";
import AuditPanel from "./AuditPanel";

type Tab = "settings" | "access" | "audit";

export default function Administracion({ teens, attendanceMap, dark, setDark }: { teens: Doc<"teens">[]; attendanceMap: AttendanceMap; dark: boolean; setDark: (value: boolean) => void }) {
  const auth = useAuth();
  const available = [
    auth.canManageSettings && { id: "settings" as Tab, label: "Configuración" },
    auth.canManageUsers && { id: "access" as Tab, label: "Equipo y permisos" },
    auth.canManageUsers && { id: "audit" as Tab, label: "Auditoría" },
  ].filter(Boolean) as { id: Tab; label: string }[];
  const [tab, setTab] = useState<Tab>(available[0]?.id || "settings");
  if (!available.length) return null;
  return <div className="space-y-5"><header><p className="text-xs font-semibold uppercase text-primary-700">Gestión institucional</p><h1 className="mt-0.5 font-display text-2xl font-bold">Administración</h1><p className="mt-1 text-sm text-ink/50">Configuración y controles del ministerio.</p></header><div className="flex gap-2 overflow-x-auto border-b border-ink/10 pb-2">{available.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${tab === item.id ? "bg-primary-600 text-white" : "bg-ink/[0.03] text-ink/55"}`}>{item.label}</button>)}</div>{tab === "settings" && <Ajustes teens={teens} attendanceMap={attendanceMap} dark={dark} setDark={setDark} />}{tab === "access" && <AccessControl />}{tab === "audit" && <AuditPanel />}</div>;
}
