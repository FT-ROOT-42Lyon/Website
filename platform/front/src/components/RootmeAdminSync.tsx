"use client";

import { useState } from "react";
import { api } from "~/lib/api";
import { useCategories } from "~/lib/categories-context";

interface SyncResult {
  categories: number;
  challenges: number;
  solves: number;
  usersSynced: number;
}

// Wraps the long-running POST /rootme/sync. Plenty of HTTP round-trips to
// the Root-Me API happen sequentially, so the button stays disabled with a
// pulsing label while it runs.
export function RootmeAdminSync() {
  const { refresh } = useCategories();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (
      !confirm(
        "Lancer une synchronisation complète Root-Me ?\n\nUne requête est envoyée par catégorie, par challenge et par membre lié — cela peut prendre plusieurs minutes.",
      )
    )
      return;
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const res = await api<SyncResult>("/rootme/sync", { method: "POST" });
      setResult(res);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de synchronisation");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="profile-card" style={{ marginTop: 0 }}>
      <p className="profile-card-title">Synchronisation Root-Me</p>
      <p className="profile-card-hint">
        Récupère les catégories, challenges et validations Root-Me pour tous
        les comptes liés. Nécessite <code>ROOTME_API_KEY</code> dans le .env
        du backend.
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={run}
        disabled={pending}
      >
        {pending ? "Synchronisation en cours..." : "Lancer la synchronisation"}
      </button>
      {result && (
        <p className="rootme-feedback rootme-feedback-ok">
          ✓ {result.categories} catégorie(s) · {result.challenges} challenge(s)
          · {result.solves} validation(s) sur {result.usersSynced} membre(s) liés
        </p>
      )}
      {error && <p className="rootme-feedback rootme-feedback-err">{error}</p>}
    </div>
  );
}
