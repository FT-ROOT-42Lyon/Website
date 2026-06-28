"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Bracket } from "@ft-root/shared";
import { api } from "./api";

interface BracketsContextValue {
  brackets: Bracket[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const BracketsContext = createContext<BracketsContextValue>({
  brackets: [],
  loading: true,
  refresh: async () => {},
});

export function BracketsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Bracket[]>("/brackets");
      setBrackets(data);
    } catch {
      setBrackets([]);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return (
    <BracketsContext.Provider value={{ brackets, loading, refresh }}>
      {children}
    </BracketsContext.Provider>
  );
}

export const useBrackets = () => useContext(BracketsContext);
