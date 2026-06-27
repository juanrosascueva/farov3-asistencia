import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const AUTH_TOKEN_KEY = "cristovive_auth_token";

interface AuthUser {
  _id: Id<"users">;
  email: string;
  name: string;
  role: "pastor" | "director" | "coordinador" | "leader" | "helper";
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: AuthUser["role"]) => Promise<void>;
  logout: () => Promise<void>;
  isPastor: boolean;
  isDirector: boolean;
  isCoordinador: boolean;
  isLeader: boolean;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(loadToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loginMutation = useMutation(api.users.login);
  const registerMutation = useMutation(api.users.register);
  const logoutMutation = useMutation(api.users.logout);

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

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await loginMutation({ email, password });
      saveToken(result.token);
      setToken(result.token);
    } catch (err) {
      setLoading(false);
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
    await registerMutation({ email, password, name, role, token: currentToken ?? undefined });
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
    isDirector: user?.role === "director",
    isCoordinador: user?.role === "coordinador",
    isLeader: user?.role === "leader" || user?.role === "helper",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
