import { useState, useCallback, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useAttendanceMap } from "./hooks/useAttendanceMap";
import { useLeaders, LeaderContext } from "./hooks/useLeaders";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Asistencia from "./components/Asistencia";
import Jovenes from "./components/Jovenes";
import Profile from "./components/Profile";
import Ajustes from "./components/Ajustes";
import ReportsPanel from "./components/ReportsPanel";

const DARK_KEY = "cristovive_dark_mode";

export default function App() {
  const [currentRoute, setCurrentRoute] = useState("dashboard");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem(DARK_KEY) === "true");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(DARK_KEY, String(dark));
  }, [dark]);

  const teens = useQuery(api.teens.list);
  const attendanceMap = useAttendanceMap();
  const leaderState = useLeaders();

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
      case "ajustes":
        return <Ajustes teens={teens} attendanceMap={attendanceMap} dark={dark} setDark={setDark} />;
      default:
        return null;
    }
  };

  return (
    <LeaderContext.Provider value={leaderState}>
      <Layout currentRoute={currentRoute} onNavigate={navigate} dark={dark} setDark={setDark}>
        {renderView()}
      </Layout>
    </LeaderContext.Provider>
  );
}
