import { useState, useRef, useEffect } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { stringHue } from "../lib/utils";
import { useLeaderContext } from "../hooks/useLeaders";

const ROUTES = [
  { id: "dashboard", label: "Resumen", icon: "home" },
  { id: "asistencia", label: "Asistencia", icon: "check" },
  { id: "jovenes", label: "Adolescentes", icon: "users" },
  { id: "reportes", label: "Reportes", icon: "chart" },
  { id: "ajustes", label: "Ajustes", icon: "settings" },
];

interface LayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  children: React.ReactNode;
}

export default function Layout({
  currentRoute,
  onNavigate,
  children,
}: LayoutProps) {
  return (
    <div className="max-w-7xl mx-auto lg:flex lg:gap-6 lg:px-6 lg:pt-6">
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 sticky top-6 self-start">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-9 h-9 rounded-full bg-ink flex items-center justify-center">
            <LogoIcon />
          </div>
          <div>
            <p className="font-display font-bold text-lg leading-none">Faro</p>
            <p className="text-[11px] text-ink/50 leading-none mt-0.5">
              Ministerio de Adolescentes
            </p>
          </div>
          <div className="mt-3">
            <LeaderBadge />
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {ROUTES.map((r) => (
            <button
              key={r.id}
              onClick={() => onNavigate(r.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                currentRoute === r.id
                  ? "bg-teal-50 text-teal-700"
                  : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              <Icon name={r.icon} cls="w-[18px] h-[18px]" />
              <span>{r.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-4 sm:px-6 lg:px-0 pt-5 lg:pt-0">
        <header className="flex items-center justify-between mb-5 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ink flex items-center justify-center">
              <LogoIcon />
            </div>
            <p className="font-display font-bold text-lg">Faro</p>
          </div>
          <LeaderBadge />
        </header>
        <div className="fade-in">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink/10 flex lg:hidden z-40">
        {ROUTES.map((r) => (
          <button
            key={r.id}
            onClick={() => onNavigate(r.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 ${
              currentRoute === r.id
                ? "tab-active"
                : "text-ink/45"
            }`}
          >
            <Icon name={r.icon} cls="w-5 h-5" />
            <span className="text-[10.5px] font-medium">{r.label}</span>
            <span className="tab-dot w-1 h-1 rounded-full bg-teal-600 opacity-0 scale-0 transition" />
          </button>
        ))}
      </nav>
    </div>
  );
}

const icons: Record<string, string> = {
  home: `<path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1v-9"/>`,
  check: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8.5 14.5l2 2 4-4"/>`,
  users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6h.1a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1c.2.6.8 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>`,
  chart: `<path d="M3 17l5-5 4 4 6-6" /><path d="M3 21h18" /><path d="M19 3v6" /><path d="M16 6h6" />`,
};

function Icon({ name, cls = "w-5 h-5" }: { name: string; cls?: string }) {
  const path = icons[name];
  if (!path) return null;
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

function LogoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 2L4 6V12C4 17 7.5 20.5 12 22C16.5 20.5 20 17 20 12V6L12 2Z"
        stroke="#F0A33C"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2.4" fill="#F0A33C" />
    </svg>
  );
}

function LeaderBadge() {
  const { leaders, currentLeader, setCurrentLeader } = useLeaderContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 transition ${
          currentLeader
            ? "bg-teal-50 text-teal-700 hover:bg-teal-100"
            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
      >
        {currentLeader ? (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span className="truncate max-w-[100px]">{currentLeader.name}</span>
            <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9L2.7 17a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
            <span>Seleccionar líder</span>
          </>
        )}
      </button>
      {open && (
        <div className="absolute right-0 lg:left-0 top-full mt-1 w-48 bg-white border border-ink/10 rounded-xl shadow-soft py-1 z-50">
          {leaders.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink/40">No hay líderes registrados</p>
          ) : (
            leaders.map((l) => (
              <button
                key={l.id}
                onClick={() => { setCurrentLeader(l.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-ink/5 transition ${
                  currentLeader?.id === l.id ? "text-teal-700 font-semibold" : "text-ink/70"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{
                  background: l.role === "pastor" ? "#0B7285" : l.role === "teacher" ? "#2F9E73" : l.role === "leader" ? "#E08F22" : "#E8590C"
                }} />
                <span className="truncate">{l.name}</span>
                {currentLeader?.id === l.id && (
                  <svg className="w-3.5 h-3.5 ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                )}
              </button>
            ))
          )}
          <div className="border-t border-ink/5 mt-1 pt-1">
            {currentLeader && (
              <button
                onClick={() => { setCurrentLeader(null); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-ink/40 hover:text-coral-600 hover:bg-coral-50 transition flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Avatar({
  teen,
  size = "sm",
}: {
  teen: { _id: string; nombre?: string; apellido?: string; foto?: string };
  size?: "sm" | "lg";
}) {
  const initials = (
    (teen.nombre?.[0] || "") + (teen.apellido?.[0] || "")
  ).toUpperCase();
  const dim = size === "lg" ? "w-16 h-16" : "w-10 h-10";
  const fontSize = size === "lg" ? "text-lg" : "text-xs";

  if (teen.foto) {
    return (
      <img
        src={teen.foto}
        className={`${dim} rounded-full object-cover shrink-0 border border-ink/10`}
        alt=""
      />
    );
  }
  const hue = stringHue(teen._id);
  return (
    <div
      className={`${dim} rounded-full shrink-0 flex items-center justify-center text-white ${fontSize} font-bold font-display`}
      style={{ background: `hsl(${hue} 45% 42%)` }}
    >
      {initials || "?"}
    </div>
  );
}
