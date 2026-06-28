import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { useAuth } from "../hooks/useAuth";
import { useScope } from "../hooks/useScope";

type CampusDoc = Doc<"campus">;
type MinistryDoc = Doc<"ministry">;
type GroupDoc = Doc<"group">;

export default function ScopeSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const { token, user } = useAuth();
  const { scope, setScope, scopeLabel, canViewAll } = useScope();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"campus" | "ministry" | "group">("campus");
  const ref = useRef<HTMLDivElement>(null);

  const campuses = useQuery(api.campus.list, user && token ? { token } : "skip");
  const ministries = useQuery(
    api.ministry.list,
    token && scope.campusId ? { token, campusId: scope.campusId as any } : "skip"
  );
  const groups = useQuery(
    api.group.list,
    token && scope.ministryId ? { token, ministryId: scope.ministryId as any } : "skip"
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelectCampus = (c: CampusDoc) => {
    setScope({
      campusId: c._id,
      campusName: c.name,
      ministryId: undefined,
      ministryName: undefined,
      groupId: undefined,
      groupName: undefined,
    });
    setStep("ministry");
  };

  const handleSelectMinistry = (m: MinistryDoc) => {
    setScope({
      campusId: scope.campusId,
      campusName: scope.campusName,
      ministryId: m._id,
      ministryName: m.name,
      groupId: undefined,
      groupName: undefined,
    });
    setStep("group");
  };

  const handleSelectGroup = (g: GroupDoc) => {
    setScope({
      campusId: scope.campusId,
      campusName: scope.campusName,
      ministryId: scope.ministryId,
      ministryName: scope.ministryName,
      groupId: g._id,
      groupName: g.name,
    });
    setOpen(false);
  };

  const reset = () => {
    setScope({});
    setStep("campus");
    setOpen(false);
  };

  const goBack = () => {
    if (step === "ministry") {
      setStep("campus");
      setScope({ campusId: undefined, campusName: undefined });
    } else if (step === "group") {
      setStep("ministry");
      setScope({
        campusId: scope.campusId,
        campusName: scope.campusName,
        ministryId: undefined,
        ministryName: undefined,
      });
    }
  };

  return (
    <div className={`relative ${fullWidth ? "w-full" : "max-w-full"}`} ref={ref}>
      <button
        onClick={() => { setOpen(!open); setStep("campus"); }}
        className={`flex items-center gap-1.5 text-xs font-medium rounded-2xl px-3 py-2.5 bg-ink/5 text-ink/70 hover:bg-ink/10 transition min-w-0 ${
          fullWidth ? "w-full justify-between" : ""
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span className={`truncate min-w-0 ${fullWidth ? "flex-1 text-left" : "max-w-[110px] sm:max-w-[140px]"}`}>{scopeLabel}</span>
        <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
          <div className={`absolute left-0 top-full mt-2 w-full min-w-[240px] max-w-[min(16rem,calc(100vw-2rem))] bg-card border border-ink/10 rounded-2xl shadow-soft py-1 z-50 ${
            fullWidth ? "lg:left-full lg:top-0 lg:mt-0 lg:ml-3" : ""
          }`}>
          <div className="px-3 py-2 border-b border-ink/5 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink/60">
              {step === "campus" ? "Seleccionar sede" : step === "ministry" ? "Seleccionar ministerio" : "Seleccionar grupo"}
            </p>
            {step !== "campus" && (
              <button onClick={goBack} className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold">
                Atrás
              </button>
            )}
          </div>

          {step === "campus" && (
            <div>
              {canViewAll && (
                <button
                  onClick={reset}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ink/5 transition flex items-center gap-2 ${
                    !scope.campusId ? "text-teal-700 font-semibold" : "text-ink/70"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Toda la iglesia
                  {!scope.campusId && (
                    <svg className="w-3.5 h-3.5 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </button>
              )}
              {(campuses || []).map((c) => (
                <button
                  key={c._id}
                  onClick={() => handleSelectCampus(c)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ink/5 transition flex items-center gap-2 ${
                    scope.campusId === c._id ? "text-teal-700 font-semibold" : "text-ink/70"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-teal-600" />
                  </span>
                  {c.name}
                  {scope.campusId === c._id && (
                    <svg className="w-3.5 h-3.5 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === "ministry" && (
            <div>
              {(ministries || []).map((m) => (
                <button
                  key={m._id}
                  onClick={() => handleSelectMinistry(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ink/5 transition flex items-center gap-2 ${
                    scope.ministryId === m._id ? "text-teal-700 font-semibold" : "text-ink/70"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-sage-600" />
                  </span>
                  {m.name}
                  {scope.ministryId === m._id && (
                    <svg className="w-3.5 h-3.5 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </button>
              ))}
              {(!ministries || ministries.length === 0) && (
                <p className="px-3 py-3 text-xs text-ink/40 text-center">No hay ministerios en esta sede</p>
              )}
            </div>
          )}

          {step === "group" && (
            <div>
              {(groups || []).map((g) => (
                <button
                  key={g._id}
                  onClick={() => handleSelectGroup(g)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ink/5 transition flex items-center gap-2 ${
                    scope.groupId === g._id ? "text-teal-700 font-semibold" : "text-ink/70"
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0 text-ink/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                  {g.name}
                  {scope.groupId === g._id && (
                    <svg className="w-3.5 h-3.5 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  )}
                </button>
              ))}
              {(!groups || groups.length === 0) && (
                <p className="px-3 py-3 text-xs text-ink/40 text-center">No hay grupos en este ministerio</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
