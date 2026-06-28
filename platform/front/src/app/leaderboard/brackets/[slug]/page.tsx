"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { LeaderboardEntry } from "@ft-root/shared";
import { LeaderboardTable } from "~/components/Leaderboard";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    api<BracketLeaderboard>(`/leaderboard/brackets/${slug}`)
      .then(setData)
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
        <h1>
          <span>{data.bracket.name}</span>
        </h1>
        <p className="hero-sub">// leaderboard bracket</p>
        <p className="hero-desc">{data.bracket.description}</p>
      </section>

      <div className="section">
        <p className="section-title">Classement</p>
        <LeaderboardTable entries={data.entries} />

        <p style={{ marginTop: "2rem" }}>
          <Link href="/leaderboard" className="btn">
            ← Leaderboard global
          </Link>
        </p>
      </div>

      <footer>
        <span>ft_root</span> — Club Cybersécurité 42Lyon
      </footer>
    </>
  );
}
