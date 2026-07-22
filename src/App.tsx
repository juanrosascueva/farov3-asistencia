import { Component, type ReactNode, useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAttendanceMap } from "./hooks/useAttendanceMap";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ScopeProvider, useScope } from "./hooks/useScope";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Asistencia from "./components/Asistencia";
import Jovenes from "./components/Jovenes";
import Profile from "./components/Profile";
import Ajustes from "./components/Ajustes";
import ReportsPanel from "./components/ReportsPanel";
import Campana from "./components/Campana";
import LoginPage from "./components/LoginPage";
import AccessControl from "./components/AccessControl";
import AuditPanel from "./components/AuditPanel";
import PublicTeenRegistration from "./components/PublicTeenRegistration";
import Seguimiento from "./components/Seguimiento";
import Administracion from "./components/Administracion";
import { isAuthenticationError } from "./hooks/authSession";

const DARK_KEY = "cristovive_dark_mode";

class AuthErrorBoundary extends Component<
  { children: ReactNode; onAuthenticationError: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isAuthenticationError(error)) this.props.onAuthenticationError();
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (isAuthenticationError(this.state.error)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-paper">
          <p className="text-sm text-ink/60">Tu sesión terminó. Volviendo al inicio...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-6">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-xl font-semibold text-ink">No pudimos mostrar esta pantalla</h1>
          <p className="mt-2 text-sm text-ink/60">Recarga la página para intentarlo nuevamente.</p>
          <button className="ui-button ui-button--primary mt-4" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

function AppContent() {
  const publicRegistrationToken = new URLSearchParams(window.location.search).get("t");
  const shortRegistrationCode = window.location.pathname.match(/^\/r\/([a-zA-Z0-9]+)$/)?.[1] || "";
  const isPublicRegistration = window.location.pathname === "/registro-adolescente" || Boolean(shortRegistrationCode);

  if (isPublicRegistration) {
    return <PublicTeenRegistration publicToken={publicRegistrationToken || ""} shortCode={shortRegistrationCode} />;
  }

  const { user, loading: authLoading, invalidateSession } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-ink/5 animate-pulse mb-3" />
          <p className="text-sm text-ink/50">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AuthErrorBoundary onAuthenticationError={invalidateSession}>
      <AuthenticatedApp />
    </AuthErrorBoundary>
  );
}

function AuthenticatedApp() {
  const [currentRoute, setCurrentRoute] = useState("dashboard");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === "true");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(DARK_KEY, String(dark));
  }, [dark]);

  const { token } = useAuth();
  const { scope } = useScope();
  const allTeens = useQuery(api.teens.list, token ? { token } : "skip");
  
  const teens = useMemo(() => {
    if (!allTeens) return undefined;
    return allTeens.filter(t => {
      if (scope.campusId && t.campusId !== scope.campusId) return false;
      if (scope.ministryId && t.ministryId !== scope.ministryId) return false;
      if (scope.groupId && t.groupId !== scope.groupId) return false;
      return true;
    });
  }, [allTeens, scope]);
  const attendanceMap = useAttendanceMap();

  const navigate = useCallback((route: string, profileId?: string | null) => {
    setCurrentRoute(route);
    setCurrentProfileId(profileId ?? null);
  }, []);

  if (teens === undefined || attendanceMap === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-ink/5 animate-pulse mb-3" />
          <p className="text-sm text-ink/50">Cargando...</p>
        </div>
      </div>
    );
  }

  const profileTeen = currentProfileId
    ? teens.find((t) => t._id === currentProfileId)
    : null;

  const renderView = () => {
    if (profileTeen) {
      return (
        <Profile
          teen={profileTeen}
          attendanceMap={attendanceMap}
          onBack={() => {
            setCurrentProfileId(null);
          }}
          onDeleted={() => {
            setCurrentProfileId(null);
            setCurrentRoute("jovenes");
          }}
        />
      );
    }
    switch (currentRoute) {
      case "dashboard":
        return (
          <Dashboard
            teens={teens}
            attendanceMap={attendanceMap}
            onOpenProfile={(id) => navigate(currentRoute, id)}
            onNavigate={navigate}
          />
        );
      case "asistencia":
        return (
          <Asistencia
            teens={teens}
            attendanceMap={attendanceMap}
            onOpenProfile={(id) => navigate(currentRoute, id)}
            onNavigate={navigate}
          />
        );
      case "jovenes":
        return (
          <Jovenes
            teens={teens}
            attendanceMap={attendanceMap}
            onOpenProfile={(id) => navigate(currentRoute, id)}
          />
        );
      case "reportes":
        return <ReportsPanel teens={teens} attendanceMap={attendanceMap} onOpenProfile={(id) => navigate(currentRoute, id)} />;
      case "campana":
      case "seguimiento":
        return <Seguimiento onOpenProfile={(id) => navigate(currentRoute, id)} />;
      case "ia":
        return <ReportsPanel teens={teens} attendanceMap={attendanceMap} onOpenProfile={(id) => navigate(currentRoute, id)} initialTab="ia" />;
      case "ajustes":
      case "administracion":
        return <Administracion teens={teens} attendanceMap={attendanceMap} dark={dark} setDark={setDark} />;
      case "accesos":
        return <Administracion teens={teens} attendanceMap={attendanceMap} dark={dark} setDark={setDark} />;
      case "auditoria":
        return <Administracion teens={teens} attendanceMap={attendanceMap} dark={dark} setDark={setDark} />;
      default:
        return null;
    }
  };

  return (
    <Layout currentRoute={currentRoute} onNavigate={navigate} dark={dark} setDark={setDark}>
      {renderView()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ScopeProvider>
        <AppContent />
      </ScopeProvider>
    </AuthProvider>
  );
}
