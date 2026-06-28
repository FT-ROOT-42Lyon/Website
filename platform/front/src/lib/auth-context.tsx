"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getAccessToken, setAccessToken, tryRefresh } from "./api";

export interface Me {
  id: number;
  login: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  isStaff: boolean;
  score: number;
  createdAt: string;
}

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const AuthContext = createContext<AuthContextValue>({
  me: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

interface AuthState {
  me: Me | null;
  loading: boolean;
}

// Module-level in-flight promise. Two concurrent callers — typically the two
// invocations of AuthProvider's effect under React.StrictMode in dev — share
// the same promise so only ONE POST /auth/refresh fires. Without this, both
// requests sent the same cookie; the first rotated the DB session and the
// second 401'd because that session no longer existed, logging the user out
// every reload.
let loadInFlight: Promise<Me | null> | null = null;

function loadMeShared(): Promise<Me | null> {
  if (loadInFlight) return loadInFlight;
  loadInFlight = (async () => {
    try {
      if (!getAccessToken()) {
        const refreshed = await tryRefresh();
        if (!refreshed) return null;
      }
      try {
        return await api<Me>("/users/me");
      } catch {
        setAccessToken(null);
        return null;
      }
    } finally {
      loadInFlight = null;
    }
  })();
  return loadInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ me: null, loading: true });

  const refresh = useCallback(async () => {
    const me = await loadMeShared();
    setState({ me, loading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setAccessToken(null);
      setState({ me: null, loading: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadMeShared().then((me) => {
      if (!cancelled) setState({ me, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ me: state.me, loading: state.loading, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
