import { useState, useRef, useEffect } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { stringHue } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import ScopeSwitcher from "./ScopeSwitcher";
import ChatPanel from "./ChatPanel";
import ResponsiveSheet from "./ResponsiveSheet";

const ROUTES = [
  { id: "dashboard", label: "Resumen", icon: "home" },
  { id: "asistencia", label: "Asistencia", icon: "check" },
  { id: "jovenes", label: "Adolescentes", icon: "users" },
  { id: "campana", label: "Campaña", icon: "clipboard" },
  { id: "ia", label: "IA Pastoral", icon: "sparkles", perm: "canUseAi" },
  { id: "reportes", label: "Reportes", icon: "chart", perm: "canViewReports" },
  { id: "ajustes", label: "Ajustes", icon: "settings", perm: "canManageSettings" },
  { id: "accesos", label: "Accesos", icon: "lock", perm: "canManageUsers" },
];

interface LayoutProps {
  currentRoute: string;
  onNavigate: (route: string) => void;
  children: React.ReactNode;
  dark?: boolean;
  setDark?: (v: boolean) => void;
}

export default function Layout({
  currentRoute,
  onNavigate,
  children,
  dark,
  setDark,
}: LayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const auth = useAuth();
  const { logout } = auth;
  
  const visibleRoutes = ROUTES.filter((r) => {
    if (!r.perm) return true;
    return (auth as any)[r.perm] === true;
  });

  return (
    <div className="max-w-7xl mx-auto lg:flex lg:gap-8 lg:px-6 lg:pt-6">
      <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 sticky top-6 self-start z-20">
        <div className="rounded-[28px] border border-amber-100/70 bg-card/90 shadow-soft backdrop-blur-sm p-4 mb-5 dark:border-amber-900/30 dark:bg-card/95">
          <div className="flex items-start gap-3">
            <LogoIcon />
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-display font-bold text-lg leading-none text-ink">Congregación Cristo Vive</p>
              <p className="text-[11px] text-ink/55 leading-none mt-1">
                Ministerio de Adolescentes
              </p>
            </div>
          </div>
          <div className="mt-4">
            <LeaderBadge />
          </div>
          <div className="mt-3">
            <ScopeSwitcher fullWidth />
          </div>
        </div>
        <nav className="flex flex-col gap-1 rounded-[28px] border border-amber-100/60 bg-card/88 shadow-soft backdrop-blur-sm p-3 dark:border-amber-900/30 dark:bg-card/92">
          {visibleRoutes.map((r) => (
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
        {setDark && (
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-ink/60 hover:text-ink transition mt-5 rounded-2xl border border-amber-100/60 bg-card/85 shadow-soft dark:border-amber-900/30 dark:bg-card/92"
          >
            {dark ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z"/></svg>
            )}
            <span className="text-xs">{dark ? "Modo claro" : "Modo oscuro"}</span>
          </button>
        )}
      </aside>

      <main className="flex-1 px-4 sm:px-6 lg:px-0 pt-5 lg:pt-0 pb-28 sm:pb-24 lg:pb-6">
        <header className="mb-5 space-y-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <LogoIcon />
              <div className="min-w-0">
                <p className="font-display font-bold text-base truncate">Cristo Vive</p>
                <p className="text-[11px] text-ink/45 truncate">Ministerio de Adolescentes</p>
              </div>
            </div>
            <LeaderBadge onlyAvatar />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <ScopeSwitcher fullWidth />
            </div>
            {setDark && (
              <button
                onClick={() => setDark(!dark)}
                className="w-10 h-10 rounded-xl border border-ink/10 bg-card flex items-center justify-center text-ink/45 hover:text-ink/70 transition shrink-0"
              >
                {dark ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z"/></svg>
                )}
              </button>
            )}
          </div>
        </header>
        <div className="fade-in">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-ink/10 flex lg:hidden z-40 pb-[env(safe-area-inset-bottom)]">
        {[
          { id: "dashboard", label: "Resumen", icon: "home" },
          { id: "asistencia", label: "Asistencia", icon: "check" },
          { id: "jovenes", label: "Adolescentes", icon: "users" },
        ].map((r) => (
          <button
            key={r.id}
            onClick={() => onNavigate(r.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 pressable ${
              currentRoute === r.id
                ? "tab-active text-teal-700"
                : "text-ink/45"
            }`}
          >
            <Icon name={r.icon} cls="w-5 h-5" />
            <span className="text-[10.5px] font-medium">{r.label}</span>
            <span className={`tab-dot w-1 h-1 rounded-full bg-teal-600 transition ${currentRoute === r.id ? "opacity-100 scale-100" : "opacity-0 scale-0"}`} />
          </button>
        ))}
        {/* Botón de "Más" */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 pressable ${
            ["campana", "ia", "reportes", "ajustes", "accesos"].includes(currentRoute)
              ? "tab-active text-teal-700 font-semibold"
              : "text-ink/45"
          }`}
        >
          <Icon name="menu" cls="w-5 h-5" />
          <span className="text-[10.5px] font-medium">Más</span>
          <span className={`tab-dot w-1 h-1 rounded-full bg-teal-600 transition ${["campana", "ia", "reportes", "ajustes", "accesos"].includes(currentRoute) ? "opacity-100 scale-100" : "opacity-0 scale-0"}`} />
        </button>
      </nav>

      {/* Hoja de navegación "Más" */}
      {moreOpen && (
        <ResponsiveSheet
          title="Menú de Navegación"
          onClose={() => setMoreOpen(false)}
          desktopMaxWidthClass="sm:max-w-xs"
        >
          <div className="space-y-4">
            <p className="text-[11px] font-semibold text-ink/40 uppercase tracking-wide px-1">
              Herramientas y Ajustes
            </p>
            <nav className="flex flex-col gap-1">
              {visibleRoutes.filter(r => ["campana", "ia", "reportes", "ajustes", "accesos"].includes(r.id)).map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onNavigate(r.id);
                    setMoreOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition pressable ${
                    currentRoute === r.id
                      ? "bg-teal-50 text-teal-700 dark:bg-teal-950/20 dark:text-teal-400"
                      : "text-ink/60 hover:bg-ink/5"
                  }`}
                >
                  <Icon name={r.icon} cls="w-[18px] h-[18px]" />
                  <span>{r.label}</span>
                </button>
              ))}
            </nav>

            <div className="border-t border-ink/5 pt-3 space-y-2">
              {setDark && (
                <button
                  onClick={() => setDark(!dark)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-ink/60 hover:bg-ink/5 transition pressable"
                >
                  <div className="flex items-center gap-2">
                    {dark ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z"/></svg>
                    )}
                    <span>Tema oscuro</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${dark ? "bg-teal-600" : "bg-ink/20"}`}>
                    <div className={`w-3.5 h-3.5 bg-card rounded-full absolute top-0.25 shadow transition-transform ${dark ? "left-[14px]" : "left-0.5"}`} />
                  </div>
                </button>
              )}
              
              <button
                onClick={() => {
                  logout();
                  setMoreOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-coral-600 hover:bg-coral-50 dark:hover:bg-coral-950/20 transition pressable"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </ResponsiveSheet>
      )}

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 sm:right-4 lg:bottom-4 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-xl flex items-center justify-center transition overflow-hidden ${
          chatOpen ? "bg-ink/80 scale-0" : "bg-teal-600 hover:bg-teal-700 scale-100"
        }`}
        title="Asistente de IA Pastoral"
      >
        <img
          src="/ai-bot.png"
          alt="Asistente IA"
          className="w-full h-full object-cover"
        />
      </button>
    </div>
  );
}

const icons: Record<string, string> = {
  home: `<path d="M3 11l9-7 9 7" /><path d="M5 10v9a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1v-9"/>`,
  check: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="M8.5 14.5l2 2 4-4"/>`,
  users: `<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.5 14.2c2.6.3 4.6 2.6 4.6 5.3"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6h.1a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1c.2.6.8 1 1.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>`,
  chart: `<path d="M3 17l5-5 4 4 6-6" /><path d="M3 21h18" /><path d="M19 3v6" /><path d="M16 6h6" />`,
  clipboard: `<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14l2 2 4-4" />`,
  sparkles: `<path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" /><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z" /><path d="M6 14l.8 2.2L9 17l-2.2.8L6 20l-.8-2.2L3 17l2.2-.8L6 14z" />`,
  menu: `<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>`,
  lock: `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`,
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
    <img
      src="/logo.svg"
      alt="Cristo Vive"
      className="w-9 h-9 shrink-0"
    />
  );
}

function LeaderBadge({ onlyAvatar = false }: { onlyAvatar?: boolean }) {
  const { user, logout } = useAuth();
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

  if (!user) return null;

  const initials = ((user.name?.[0] || "") + (user.name?.split(" ")[1]?.[0] || "")).toUpperCase();

  if (onlyAvatar) {
    return (
      <div className="relative shrink-0" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="w-9 h-9 rounded-full bg-teal-600/10 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400 font-bold text-xs flex items-center justify-center pressable border border-teal-600/20"
          title={user.name}
        >
          {initials || (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-card border border-ink/10 rounded-2xl shadow-soft py-1 z-50">
            <div className="px-3 py-2 border-b border-ink/5 mb-1">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[11px] text-ink/40 capitalize truncate">{user.role} · {user.email}</p>
            </div>
            <div className="border-t border-ink/5 mt-1 pt-1">
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-ink/40 hover:text-coral-600 hover:bg-coral-50 transition flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-xs font-medium rounded-2xl px-3 py-2.5 transition bg-gradient-to-r from-teal-50 to-amber-50 text-teal-700 hover:from-teal-100 hover:to-amber-100 dark:from-teal-50/10 dark:to-amber-50/10 dark:text-amber-100"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        <span className="truncate flex-1 text-left">{user.name}</span>
        <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-card border border-ink/10 rounded-2xl shadow-soft py-1 z-50 xl:right-auto xl:left-full xl:top-0 xl:mt-0 xl:ml-3">
          <div className="px-3 py-2 border-b border-ink/5 mb-1">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-[11px] text-ink/40 capitalize truncate">{user.role} · {user.email}</p>
          </div>
          <div className="border-t border-ink/5 mt-1 pt-1">
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-ink/40 hover:text-coral-600 hover:bg-coral-50 transition flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Cerrar sesión
            </button>
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
