import { useState, useRef, useEffect } from "react";
import type { Doc } from "../../convex/_generated/dataModel";
import { stringHue } from "../lib/utils";
import { useAuth } from "../hooks/useAuth";
import ScopeSwitcher from "./ScopeSwitcher";
import ChatPanel from "./ChatPanel";
import ResponsiveSheet from "./ResponsiveSheet";
import { useScope } from "../hooks/useScope";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import MyProfileModal from "./MyProfileModal";
import UiIcon from "./UiIcon";

const ROUTES = [
  { id: "dashboard", label: "Mi ministerio", icon: "home", section: "operacion" },
  { id: "asistencia", label: "Asistencia", icon: "check", section: "operacion" },
  { id: "jovenes", label: "Adolescentes", icon: "users", section: "operacion" },
  { id: "seguimiento", label: "Seguimiento", icon: "clipboard", section: "operacion" },
  { id: "reportes", label: "Analítica", icon: "chart", perms: ["canViewReports"], section: "analitica" },
  { id: "administracion", label: "Administración", icon: "settings", perms: ["canManageSettings", "canManageUsers"], section: "administracion" },
];

interface LayoutProps {
  currentRoute: string;
  onNavigate: (route: string, profileId?: string | null) => void;
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
  const { scope, scopeLabel } = useScope();
  
  const visibleRoutes = ROUTES.filter((route) => !route.perms || route.perms.some((permission) => (auth as any)[permission]));

  const displaySubtitle = scope.campusId ? scopeLabel : "Ministerio de Adolescentes";

  return (
    <div className="app-shell max-w-7xl mx-auto lg:flex lg:gap-6 lg:px-6 lg:pt-6">
      <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 sticky top-6 self-start z-20">
        <div className="rounded-[20px] border border-ink/10 bg-card/90 shadow-soft backdrop-blur-sm p-4 mb-4 dark:bg-card/95">
          <div className="flex items-start gap-3">
            <LogoIcon />
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-display font-bold text-lg leading-none text-ink">Congregación Cristo Vive</p>
              <p className="text-xs text-primary-600 font-semibold leading-none mt-1.5 truncate" title={displaySubtitle}>
                {displaySubtitle}
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
        <nav className="rounded-[20px] border border-ink/10 bg-card/88 shadow-soft backdrop-blur-sm p-3 dark:bg-card/92">
          {(["operacion", "analitica", "administracion"] as const).map((section) => {
            const routes = visibleRoutes.filter((route) => route.section === section);
            if (!routes.length) return null;
            return <div key={section} className="mb-3 last:mb-0"><p className="px-3 pb-1 text-[10px] font-bold uppercase text-ink/35">{section === "operacion" ? "Operación" : section === "analitica" ? "Analítica" : "Administración"}</p><div className="flex flex-col gap-1">{routes.map((r) => <button key={r.id} onClick={() => onNavigate(r.id)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${currentRoute === r.id || (["campana", "ia", "ajustes", "accesos", "auditoria"].includes(currentRoute) && r.id === "administracion") ? "bg-primary-50 text-primary-700" : "text-ink/60 hover:bg-ink/5"}`}><Icon name={r.icon} cls="w-[18px] h-[18px]" /><span>{r.label}</span></button>)}</div></div>;
          })}
        </nav>
        {setDark && (
          <button
            onClick={() => setDark(!dark)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-ink/60 hover:text-ink transition mt-4 rounded-2xl border border-ink/10 bg-card/85 shadow-soft dark:bg-card/92"
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

      <main className="flex-1 px-3 sm:px-6 lg:px-0 pt-5 lg:pt-0 pb-28 sm:pb-24 lg:pb-6">
        <header className="appbar mb-5 space-y-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <LogoIcon />
              <div className="min-w-0">
                <p className="font-display font-bold text-base truncate">Cristo Vive</p>
                <p className="text-xs text-primary-600 font-semibold truncate" title={displaySubtitle}>
                  {displaySubtitle}
                </p>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-ink/10 flex lg:hidden z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_14px_rgba(37,35,45,0.06)]">
        {[
          { id: "dashboard", label: "Mi ministerio", icon: "home" },
          { id: "asistencia", label: "Asistencia", icon: "check" },
          { id: "jovenes", label: "Adolescentes", icon: "users" },
          { id: "seguimiento", label: "Seguimiento", icon: "clipboard" },
        ].map((r) => (
          <button
            key={r.id}
            onClick={() => onNavigate(r.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 pressable ${
              currentRoute === r.id
                ? "tab-active text-primary-700"
                : "text-ink/45"
            }`}
          >
            <Icon name={r.icon} cls="w-5 h-5" />
            <span className="text-micro font-medium">{r.label}</span>
            <span className={`tab-dot w-1 h-1 rounded-full bg-primary-600 transition ${currentRoute === r.id ? "opacity-100 scale-100" : "opacity-0 scale-0"}`} />
          </button>
        ))}
        {/* Botón de "Más" */}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 pressable ${
            ["campana", "ia", "reportes", "administracion", "ajustes", "accesos", "auditoria"].includes(currentRoute)
              ? "tab-active text-primary-700 font-semibold"
              : "text-ink/45"
          }`}
        >
          <Icon name="menu" cls="w-5 h-5" />
          <span className="text-micro font-medium">Más</span>
          <span className={`tab-dot w-1 h-1 rounded-full bg-primary-600 transition ${["campana", "ia", "reportes", "administracion", "ajustes", "accesos", "auditoria"].includes(currentRoute) ? "opacity-100 scale-100" : "opacity-0 scale-0"}`} />
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
            <p className="text-xs font-semibold text-ink/40 uppercase tracking-wide px-1">
              Herramientas y Ajustes
            </p>
            <nav className="flex flex-col gap-1">
              {visibleRoutes.filter(r => ["reportes", "administracion"].includes(r.id)).map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    onNavigate(r.id);
                    setMoreOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition pressable ${
                    currentRoute === r.id
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400"
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
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${dark ? "bg-primary-600" : "bg-ink/20"}`}>
                    <div className={`w-3.5 h-3.5 bg-card rounded-full absolute top-0.25 shadow transition-transform ${dark ? "left-[14px]" : "left-0.5"}`} />
                  </div>
                </button>
              )}
              
              <button
                onClick={() => {
                  logout();
                  setMoreOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950/20 transition pressable"
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

      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} onNavigate={onNavigate} />}

      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 sm:right-4 lg:bottom-4 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-xl flex items-center justify-center transition overflow-hidden ${
          chatOpen ? "bg-ink/80 scale-0" : "bg-primary-600 hover:bg-primary-700 scale-100"
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

function Icon({ name, cls = "w-5 h-5" }: { name: string; cls?: string }) {
  const icons: Record<string, any> = { home: "House", check: "CalendarCheck", users: "UsersRound", settings: "Settings", chart: "ChartNoAxesCombined", clipboard: "ClipboardCheck", sparkles: "Sparkles", menu: "Menu", lock: "Lock" };
  return <UiIcon name={icons[name]} className={cls} />;
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
  const [showSettings, setShowSettings] = useState(false);
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
          className="w-9 h-9 rounded-full bg-primary-600/10 text-primary-700 dark:bg-primary-950/30 dark:text-primary-400 font-bold text-xs flex items-center justify-center pressable border border-primary-600/20 overflow-hidden"
          title={user.name}
        >
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : initials ? (
            initials
          ) : (
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
              <p className="text-xs text-ink/40 capitalize truncate">{user.role} · {user.email}</p>
            </div>
            <div className="border-t border-ink/5 mt-1 pt-1">
              <button
                onClick={() => { setShowSettings(true); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-ink/70 hover:text-primary-700 hover:bg-primary-50 transition flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                Mi perfil
              </button>
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-ink/40 hover:text-danger-600 hover:bg-danger-50 transition flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
        {showSettings && <MyProfileModal onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-xs font-medium rounded-2xl px-3 py-2.5 transition bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-50/10 dark:text-primary-100"
      >
        <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-primary-600/10 flex items-center justify-center">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          )}
        </div>
        <span className="truncate flex-1 text-left">{user.name}</span>
        <svg className="w-3 h-3 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-card border border-ink/10 rounded-2xl shadow-soft py-1 z-50 xl:right-auto xl:left-full xl:top-0 xl:mt-0 xl:ml-3">
          <div className="px-3 py-2 border-b border-ink/5 mb-1">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <p className="text-xs text-ink/40 capitalize truncate">{user.role} · {user.email}</p>
          </div>
          <div className="border-t border-ink/5 mt-1 pt-1">
            <button
              onClick={() => { setShowSettings(true); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-ink/70 hover:text-primary-700 hover:bg-primary-50 transition flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              Mi perfil
            </button>
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-ink/40 hover:text-danger-600 hover:bg-danger-50 transition flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
      {showSettings && <MyProfileModal onClose={() => setShowSettings(false)} />}
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
