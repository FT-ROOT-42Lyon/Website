"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { LeaderboardEntry, TimelineSeries } from "@ft-root/shared";
import { LeaderboardTable } from "~/components/Leaderboard";
import { ScoreTimeline } from "~/components/charts/ScoreTimeline";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { Footer } from "~/components/Footer";

interface BracketLeaderboard {
  bracket: {
    id: number;
    slug: string;
    name: string;
    description: string;
  };
  entries: LeaderboardEntry[];
}

export default function BracketLeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { me, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BracketLeaderboard | null>(null);
  const [timeline, setTimeline] = useState<TimelineSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    Promise.all([
      api<BracketLeaderboard>(`/leaderboard/brackets/${slug}`),
      api<TimelineSeries[]>(`/leaderboard/brackets/${slug}/timeline`),
    ])
      .then(([d, t]) => {
        setData(d);
        setTimeline(t);
      })
      .catch(() => setError("Bracket introuvable"));
  }, [slug, me, authLoading, router]);

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

  if (!data) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  return (
    <>
      <section className="hero">
        <h1>{data.bracket.name}</h1>
        <p className="hero-sub">// leaderboard bracket</p>
        <p className="hero-desc">{data.bracket.description}</p>
      </section>

      <div className="section">
        <p className="section-title">Classement</p>
        <LeaderboardTable entries={data.entries} />

        <p className="section-title" style={{ marginTop: "3rem" }}>
          Évolution des scores
        </p>
        {!timeline ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : (
          <ScoreTimeline series={timeline} showLegend />
        )}

        <p style={{ marginTop: "2rem" }}>
          <Link href="/leaderboard" className="btn">
            ← Leaderboard global
          </Link>
        </p>
      </div>

      <Footer />
    </>
  );
}
