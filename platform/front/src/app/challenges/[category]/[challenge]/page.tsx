"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Challenge, SubmitFlagResponse } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type FlagState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "wrong" }
  | { kind: "correct"; awarded: number }
  | { kind: "already" }
  | { kind: "error"; message: string };

export default function ChallengePage() {
  const { category, challenge: slug } = useParams<{
    category: string;
    challenge: string;
  }>();
  const { me, loading: authLoading, refresh: refreshAuth } = useAuth();
  const router = useRouter();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flag, setFlag] = useState("");
  const [state, setState] = useState<FlagState>({ kind: "idle" });

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    api<Challenge>(`/challenges/${slug}`)
      .then(setChallenge)
      .catch(() => setError("Challenge introuvable"));
  }, [slug, me, authLoading, router]);

  async function submitFlag(e?: React.FormEvent) {
    e?.preventDefault();
    if (!challenge || !flag.trim()) return;
    setState({ kind: "submitting" });

    try {
      const res = await api<SubmitFlagResponse>(
        `/challenges/${challenge.slug}/submit`,
        { method: "POST", body: JSON.stringify({ flag }) },
      );

      if (!res.correct) {
        setState({ kind: "wrong" });
        return;
      }

      if (res.alreadySolved) {
        setState({ kind: "already" });
        return;
      }

      setState({ kind: "correct", awarded: res.scoreAwarded });
      setFlag("");
      // Refresh challenge to flip `solved` + global score in nav.
      const refreshed = await api<Challenge>(`/challenges/${challenge.slug}`);
      setChallenge(refreshed);
      await refreshAuth();
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Erreur",
      });
    }
  }

  if (authLoading || !me) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="callback">
        <p className="callback-mono" style={{ color: "var(--red)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  const files = challenge.resources.filter((r) => r.type === "FILE");
  const links = challenge.resources.filter((r) => r.type === "LINK");

  return (
    <>
      <section className="hero">
        <h1>
          <span>{challenge.title}</span>
        </h1>
        <p className="hero-sub">// {challenge.category.name}</p>
        {challenge.solved && (
          <p className="solved-pill">✓ validé — {challenge.score} pts</p>
        )}
      </section>

      <div className="section">
        <p className="section-title">Énoncé</p>
        <div className="challenge-desc">{challenge.description}</div>

        {(files.length > 0 || links.length > 0) && (
          <>
            <p className="section-title" style={{ marginTop: "3rem" }}>
              Ressources
            </p>
            <div className="resource-grid">
              {files.map((f) => (
                <a
                  key={f.id}
                  href={`${API_URL}${f.href}`}
                  download
                  className="resource-btn resource-file"
                >
                  <span className="resource-tag">// file</span>
                  <span className="resource-label">{f.label}</span>
                  <span className="resource-action">Télécharger ↓</span>
                </a>
              ))}
              {links.map((l) => (
                <a
                  key={l.id}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="resource-btn resource-link"
                >
                  <span className="resource-tag">// link</span>
                  <span className="resource-label">{l.label}</span>
                  <span className="resource-action">Ouvrir ↗</span>
                </a>
              ))}
            </div>
          </>
        )}

        <p className="section-title" style={{ marginTop: "3rem" }}>
          Soumettre un flag
        </p>

        {!challenge.hasFlag ? (
          <div className="empty-card">
            <p className="empty-tag">// no_flag</p>
            <p>Aucun flag n&apos;a encore été configuré pour ce challenge.</p>
          </div>
        ) : (
          <form
            className={`flag-form flag-form-${challenge.solved ? "solved" : "unsolved"}`}
            onSubmit={submitFlag}
          >
            <div className="flag-input-wrap">
              <span className="flag-prompt">$</span>
              <input
                type="text"
                value={flag}
                onChange={(e) => {
                  setFlag(e.target.value);
                  setState({ kind: "idle" });
                }}
                placeholder="ft_root{...}"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={state.kind === "submitting"}
                className="flag-input"
              />
              <button
                type="submit"
                className="btn btn-primary flag-submit"
                disabled={state.kind === "submitting" || !flag.trim()}
              >
                {state.kind === "submitting" ? "..." : "Soumettre →"}
              </button>
            </div>

            {state.kind === "wrong" && (
              <div className="flag-msg flag-msg-wrong">
                ✗ Flag incorrect.
              </div>
            )}
            {state.kind === "correct" && (
              <div className="flag-msg flag-msg-correct">
                ✓ Flag valide — {state.awarded} points crédités.
              </div>
            )}
            {state.kind === "already" && (
              <div className="flag-msg flag-msg-already">
                ⓘ Tu as déjà validé ce challenge.
              </div>
            )}
            {state.kind === "error" && (
              <div className="flag-msg flag-msg-wrong">
                {state.message}
              </div>
            )}
          </form>
        )}

        <p style={{ marginTop: "3rem" }}>
          <Link href={`/challenges/${category}`} className="btn">
            ← Retour aux challenges
          </Link>
        </p>
      </div>

      <footer>
        <span>ft_root</span> — Club Cybersécurité 42Lyon
      </footer>
    </>
  );
}
