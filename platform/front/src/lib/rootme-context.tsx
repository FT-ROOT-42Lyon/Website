"use client";

import { useMemo } from "react";
import type { Category } from "@ft-root/shared";
import { useCategories } from "./categories-context";

// Root-Me categories live in the same `categories` table — they're just rows
// whose `rootmeId` is non-null. This hook is a thin filter over the existing
// categories context so the rest of the app shares a single source of truth.
export function useRootme(): {
  categories: Category[];
  loading: boolean;
} {
  const { categories, loading } = useCategories();
  const rootmeCategories = useMemo(
    () => categories.filter((c) => c.rootmeId !== null),
    [categories],
  );
  return { categories: rootmeCategories, loading };
}

// Backward-compatible Provider wrapper — kept so the existing layout import
// still resolves but it's a no-op now.
export function RootmeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
