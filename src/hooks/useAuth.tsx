import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const AUTH_TOKEN_KEY = "cristovive_auth_token";

interface AuthUser {
  _id: Id<"users">;
  email: string;
  name: string;
  role: "admin" | "pastor" | "director" | "coordinador" | "leader" | "helper";
  permissions: string[];
  avatar?: string;
  phone?: string;
  birthDate?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: AuthUser["role"]) => Promise<void>;
  logout: () => Promise<void>;
  isPastor: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canUseAi: boolean;
  canDeleteTeens: boolean;
  canWriteTeens: boolean;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

function loadToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

function getDeviceInfo(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; mobile?: boolean } };
  const platform = nav.userAgentData?.platform || navigator.platform || "unknown-platform";
  const mobile = nav.userAgentData?.mobile ? "mobile" : "desktop";
  const language = navigator.language || "unknown-language";
  return `${platform} | ${mobile} | ${language} | ${navigator.userAgent}`;
}

async function getPublicIp(): Promise<string | undefined> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    if (!res.ok) return undefined;
    const data = await res.json();
    return typeof data.ip === "string" ? data.ip : undefined;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(loadToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loginMutation = useMutation(api.users.login);
  const registerMutation = useMutation(api.users.register);
  const logoutMutation = useMutation(api.users.logout);
  const updateSessionDevice = useMutation(api.users.updateSessionDevice);

  // Fetch user data when token changes
  const userData = useQuery(api.users.getMe, token ? { token } : "skip");

  useEffect(() => {
    if (userData === undefined) {
      // Still loading
      if (!token) setLoading(false);
      return;
    }
    if (userData === null) {
      clearToken();
      setToken(null);
      setUser(null);
    } else {
      setUser(userData as AuthUser | null);
    }
    setLoading(false);
  }, [userData, token]);

  useEffect(() => {
    if (!token) return;
    getPublicIp()
      .then((ip) => updateSessionDevice({ token, userAgent: getDeviceInfo(), ip }))
      .catch(() => updateSessionDevice({ token, userAgent: getDeviceInfo() }).catch(() => {}));
  }, [token, updateSessionDevice]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const ip = await getPublicIp();
      const result = await loginMutation({
        email: email.trim().toLowerCase(),
        password,
        userAgent: getDeviceInfo(),
      });
      saveToken(result.token);
      setToken(result.token);
      updateSessionDevice({ token: result.token, userAgent: getDeviceInfo(), ip }).catch(() => {});
    } catch (err) {
      throw err;
    }
  }, [loginMutation]);

  const register = useCallback(async (
    email: string,
    password: string,
    name: string,
    role: AuthUser["role"]
  ) => {
    const currentToken = loadToken();
    await registerMutation({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim(),
      role,
      token: currentToken ?? undefined,
    });
  }, [registerMutation]);

  const logout = useCallback(async () => {
    const t = token;
    if (t) {
      try { await logoutMutation({ token: t }); } catch { /* ignore */ }
    }
    clearToken();
    setToken(null);
    setUser(null);
  }, [token, logoutMutation]);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isPastor: user?.role === "pastor",
    canManageUsers: user?.permissions?.includes("manage_users") ?? false,
    canManageSettings: user?.permissions?.includes("manage_settings") ?? false,
    canViewReports: user?.permissions?.includes("view_reports") ?? false,
    canUseAi: user?.permissions?.includes("use_ai") ?? false,
    canDeleteTeens: user?.permissions?.includes("delete_teens") ?? false,
    canWriteTeens: user?.permissions?.includes("write_teens") ?? false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
