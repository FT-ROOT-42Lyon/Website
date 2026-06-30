"use client";

import { useState } from "react";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { useCategories } from "~/lib/categories-context";

// Self-service Root-Me linking card, rendered on the user's own profile page.
// Calling /rootme/link both stores the link AND pulls the initial set of
// validations, so by the time the request returns the catalog and the user's
// solves are in sync.
export function RootmeLinkCard() {
  const { me, refresh } = useAuth();
  const { refresh: refreshCategories } = useCategories();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<"link" | "unlink" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!me) return null;

  async function link(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setInfo(null);
    setPending("link");
    try {
      const res = await api<{ rootmeUsername: string }>("/rootme/link", {
        method: "POST",
        body: JSON.stringify({ identifier: input.trim() }),
      });
      setInput("");
      setInfo(`✓ lié à ${res.rootmeUsername}`);
      await Promise.all([refresh(), refreshCategories()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPending(null);
    }
  }

  async function unlink() {
    if (!confirm("Délier ton compte Root-Me ?\n\nTes validations Root-Me importées sur la plateforme seront retirées.")) {
      return;
    }
    setError(null);
    setInfo(null);
    setPending("unlink");
    try {
      await api("/rootme/link", { method: "DELETE" });
      await refresh();
      setInfo("Compte délié");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPending(null);
    }
  }

  async function syncMine() {
    setError(null);
    setInfo(null);
    setPending("sync");
    try {
      const res = await api<{ added: number }>("/rootme/sync-mine", { method: "POST" });
      setInfo(`✓ ${res.added} validation(s) synchronisée(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="profile-card">
      <p className="profile-card-title">Root-Me</p>
      {me.rootmeId ? (
        <>
          <p className="profile-card-hint">
            Lié à{" "}
            <a
              href={
                me.rootmeUsername
                  ? `https://www.root-me.org/${encodeURIComponent(me.rootmeUsername)}?lang=fr`
                  : `https://www.root-me.org/?page=auteur&id_auteur=${me.rootmeId}`
              }
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--red)" }}
            >
              {me.rootmeUsername ?? me.rootmeId} ↗
            </a>
          </p>
          <div className="rootme-actions">
            <button
              type="button"
              className="btn"
              onClick={syncMine}
              disabled={pending !== null}
            >
              {pending === "sync" ? "Synchronisation..." : "Synchroniser mes validations"}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={unlink}
              disabled={pending !== null}
            >
              {pending === "unlink" ? "..." : "Délier"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="profile-card-hint">
            Lie ton compte Root-Me pour faire apparaître tes validations sur
            la plateforme.
          </p>
          <form onSubmit={link} className="rootme-link-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="ton login Root-Me ou id_auteur"
              autoComplete="off"
              spellCheck={false}
              disabled={pending !== null}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending !== null || !input.trim()}
            >
              {pending === "link" ? "Recherche..." : "Lier"}
            </button>
          </form>
        </>
      )}
      {info && <p className="rootme-feedback rootme-feedback-ok">{info}</p>}
      {error && <p className="rootme-feedback rootme-feedback-err">{error}</p>}
    </div>
  );
}
