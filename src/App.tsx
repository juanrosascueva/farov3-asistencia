import { useState, useCallback, useEffect, useMemo } from "react";
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
import AiPanel from "./components/AiPanel";
import LoginPage from "./components/LoginPage";
import AccessControl from "./components/AccessControl";
import AuditPanel from "./components/AuditPanel";

const DARK_KEY = "cristovive_dark_mode";

function AppContent() {
  const [currentRoute, setCurrentRoute] = useState("dashboard");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === "true");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(DARK_KEY, String(dark));
  }, [dark]);

  const { user, token, loading: authLoading } = useAuth();
  const { scope } = useScope();
  const allTeens = useQuery(api.teens.list, token ? { token } : {});
  
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

  if (authLoading || teens === undefined || attendanceMap === undefined) {
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
          />
        );
      case "asistencia":
        return (
          <Asistencia
            teens={teens}
            attendanceMap={attendanceMap}
            onOpenProfile={(id) => navigate(currentRoute, id)}
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
        return <ReportsPanel teens={teens} attendanceMap={attendanceMap} />;
      case "campana":
        return (
          <Campana
            teens={teens}
            attendanceMap={attendanceMap}
            onOpenProfile={(id) => navigate(currentRoute, id)}
          />
        );
      case "ia":
        return (
          <AiPanel
            teens={teens}
            attendanceMap={attendanceMap}
            onOpenProfile={(id) => navigate(currentRoute, id)}
          />
        );
      case "ajustes":
        return <Ajustes teens={teens} attendanceMap={attendanceMap} dark={dark} setDark={setDark} />;
      case "accesos":
        return <AccessControl />;
      case "auditoria":
        return <AuditPanel />;
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
