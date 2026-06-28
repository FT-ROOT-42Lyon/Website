"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { LeaderboardEntry, TimelineSeries } from "@ft-root/shared";
import { eventStatus } from "@ft-root/shared";
import { LeaderboardTable } from "~/components/Leaderboard";
import { ScoreTimeline } from "~/components/charts/ScoreTimeline";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { Footer } from "~/components/Footer";

interface EventLeaderboard {
  event: {
    id: number;
    slug: string;
    name: string;
    description: string;
    startsAt: string;
    endsAt: string;
  };
  entries: LeaderboardEntry[];
}

function formatRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(startsAt))} → ${fmt.format(new Date(endsAt))}`;
}

export default function EventLeaderboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { me, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<EventLeaderboard | null>(null);
  const [timeline, setTimeline] = useState<TimelineSeries[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    Promise.all([
      api<EventLeaderboard>(`/leaderboard/events/${slug}`),
      api<TimelineSeries[]>(`/leaderboard/events/${slug}/timeline`),
    ])
      .then(([d, t]) => {
        setData(d);
        setTimeline(t);
      })
      .catch(() => setError("Événement introuvable"));
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

  const status = eventStatus(data.event);
  const statusLabel =
    status === "active" ? "en cours" : status === "past" ? "terminé" : "à venir";

  return (
    <>
      <section className="hero">
        <h1>{data.event.name}</h1>
        <p className="hero-sub">
          // leaderboard événement · {statusLabel}
        </p>
        <p className="hero-desc">
          {formatRange(data.event.startsAt, data.event.endsAt)}
        </p>
        {data.event.description && (
          <p className="hero-desc">{data.event.description}</p>
        )}
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
          </Link>{" "}
          <Link href={`/events/${data.event.slug}`} className="btn">
            Page de l&apos;événement →
          </Link>
        </p>
      </div>

      <Footer />
    </>
  );
}
