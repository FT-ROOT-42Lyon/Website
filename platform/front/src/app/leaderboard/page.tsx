"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LeaderboardEntry, TimelineSeries } from "@ft-root/shared";
import { LeaderboardTable } from "~/components/Leaderboard";
import { ScoreTimeline } from "~/components/charts/ScoreTimeline";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { useEvents } from "~/lib/events-context";
import { Footer } from "~/components/Footer";

export default function GlobalLeaderboardPage() {
  const { me, loading: authLoading } = useAuth();
  const { events } = useEvents();
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [timeline, setTimeline] = useState<TimelineSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    Promise.all([
      api<LeaderboardEntry[]>("/leaderboard"),
      api<TimelineSeries[]>("/leaderboard/timeline?top=10"),
    ])
      .then(([e, t]) => {
        setEntries(e);
        setTimeline(t);
      })
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
        <h1>Leaderboard</h1>
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

        <p className="section-title" style={{ marginTop: "3rem" }}>
          Évolution des scores
          <small
            style={{
              marginLeft: "0.8rem",
              color: "var(--muted)",
              fontSize: 11,
              letterSpacing: "0.05em",
              textTransform: "none",
            }}
          >
            top 10
          </small>
        </p>
        {!timeline ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : (
          <ScoreTimeline series={timeline} showLegend />
        )}

        {events.length > 0 && (
          <>
            <p className="section-title" style={{ marginTop: "3rem" }}>
              Leaderboards par événement
            </p>
            <div className="cards">
              {events.map((e) => (
                <Link
                  key={e.slug}
                  href={`/leaderboard/events/${e.slug}`}
                  className="card card-link-block"
                >
                  <p className="card-tag">// événement</p>
                  <h3>{e.name}</h3>
                  {e.description && (
                    <p>
                      {e.description.length > 140
                        ? e.description.slice(0, 140) + "..."
                        : e.description}
                    </p>
                  )}
                  <span className="card-link">
                    Voir ({e.memberCount}) →
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  );
}
