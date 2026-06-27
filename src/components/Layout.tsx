import type { Doc } from "../../convex/_generated/dataModel";
import { stringHue } from "../lib/utils";

const ROUTES = [
  { id: "dashboard", label: "Resumen", icon: "home" },
  { id: "asistencia", label: "Asistencia", icon: "check" },
  { id: "jovenes", label: "Adolescentes", icon: "users" },
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
