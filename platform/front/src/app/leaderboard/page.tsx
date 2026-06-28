"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardEntry } from "@ft-root/shared";
import { LeaderboardTable } from "~/components/Leaderboard";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { useBrackets } from "~/lib/brackets-context";

export default function GlobalLeaderboardPage() {
  const { me, loading: authLoading } = useAuth();
  const { brackets } = useBrackets();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    api<LeaderboardEntry[]>("/leaderboard")
      .then(setEntries)
      .catch(() => setError("Impossible de charger le leaderboard"));
  }, [me, authLoading, router]);

  if (authLoading || !me) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  return (
    <>
      <section className="hero">
        <h1>
          <span>Leaderboard</span>
        </h1>
        <p className="hero-sub">// classement global</p>
        <p className="hero-desc">
          Tous les utilisateurs classés par leur score cumulé sur la
          plateforme.
        </p>
      </section>

      <div className="section">
        <p className="section-title">Classement</p>
        {error ? (
          <p style={{ color: "var(--red)" }}>{error}</p>
        ) : !entries ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : (
          <LeaderboardTable entries={entries} />
        )}

        {brackets.length > 0 && (
          <>
            <p className="section-title" style={{ marginTop: "3rem" }}>
              Leaderboards par bracket
            </p>
            <div className="cards">
              {brackets.map((b) => (
                <Link
                  key={b.slug}
                  href={`/leaderboard/brackets/${b.slug}`}
                  className="card card-link-block"
                >
                  <p className="card-tag">// bracket</p>
                  <h3>{b.name}</h3>
                  <p>
                    {b.description.length > 140
                      ? b.description.slice(0, 140) + "..."
                      : b.description}
                  </p>
                  <span className="card-link">
                    Voir ({b.memberCount}) →
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <footer>
        <span>ft_root</span> — Club Cybersécurité 42Lyon
      </footer>
    </>
  );
}
