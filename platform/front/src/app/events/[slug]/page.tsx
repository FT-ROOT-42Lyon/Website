"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { EventDetail } from "@ft-root/shared";
import { DIFFICULTY_LABELS, eventStatus } from "@ft-root/shared";
import { api } from "~/lib/api";
import { Footer } from "~/components/Footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<EventDetail>(`/events/${slug}`)
      .then(setEvent)
      .catch(() => setError("Événement introuvable"));
  }, [slug]);

  // Group challenges by category, sort categories alphabetically and items
  // within each category by ascending point value.
  const grouped = useMemo(() => {
    if (!event) return [];
    const map = new Map<
      string,
      {
        category: { slug: string; name: string };
        items: EventDetail["challenges"];
      }
    >();
    for (const ec of event.challenges) {
      const key = ec.challenge.category.slug;
      if (!map.has(key)) {
        map.set(key, {
          category: ec.challenge.category,
          items: [],
        });
      }
      map.get(key)!.items.push(ec);
    }
    return [...map.values()]
      .sort((a, b) =>
        a.category.name.localeCompare(b.category.name, "fr"),
      )
      .map((g) => ({
        ...g,
        items: [...g.items].sort(
          (a, b) =>
            a.challenge.score - b.challenge.score ||
            a.challenge.title.localeCompare(b.challenge.title, "fr"),
        ),
      }));
  }, [event]);

  if (error) {
    return (
      <div className="callback">
        <p className="callback-mono" style={{ color: "var(--red)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  const status = eventStatus(event);
  const statusLabel =
    status === "active" ? "en cours" : status === "past" ? "terminé" : "à venir";

  return (
    <>
      <section className="hero">
        <h1>{event.name}</h1>
        <p className="hero-sub">// {statusLabel}</p>
      </section>

      <div className="section">
        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${API_URL}${event.imageUrl}`}
            alt={event.name}
            className="event-hero-image"
          />
        )}

        <p className="section-title">Quand</p>
        <div className="kv-card">
          <div>
            début: <span>{formatDate(event.startsAt)}</span>
          </div>
          <div>
            fin: <span>{formatDate(event.endsAt)}</span>
          </div>
        </div>

        {event.description && (
          <>
            <p className="section-title" style={{ marginTop: "3rem" }}>
              Description
            </p>
            <div className="challenge-desc">{event.description}</div>
          </>
        )}

        {grouped.length > 0 && (
          <>
            <p className="section-title" style={{ marginTop: "3rem" }}>
              Challenges ({event.challenges.length})
            </p>
            <p
              style={{
                color: "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                marginBottom: "1.5rem",
              }}
            >
              // valider ces challenges pendant la durée crédite aussi le score
              de l&apos;événement aux membres
            </p>

            {grouped.map((g) => (
              <div key={g.category.slug} className="event-cat-block">
                <div className="event-cat-head">
                  <Link
                    href={`/challenges/${g.category.slug}`}
                    className="event-cat-name"
                  >
                    {g.category.name}
                  </Link>
                  <span className="event-cat-count">{g.items.length}</span>
                </div>
                <div className="chal-list">
                  <div className="chal-list-row chal-list-head">
                    <div>titre</div>
                    <div>difficulté</div>
                    <div className="chal-list-score">score</div>
                  </div>
                  {g.items.map((ec) => (
                    <Link
                      key={ec.id}
                      href={`/challenges/${g.category.slug}/${ec.challenge.slug}`}
                      className="chal-list-row chal-list-link"
                    >
                      <div className="chal-list-title">
                        {ec.challenge.title}
                      </div>
                      <div>
                        <span
                          className={`diff-badge diff-${ec.challenge.difficulty}`}
                        >
                          {DIFFICULTY_LABELS[ec.challenge.difficulty]}
                        </span>
                      </div>
                      <div className="chal-list-score">
                        {ec.challenge.score} pts
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        <p style={{ marginTop: "3rem" }}>
          <Link href={`/leaderboard/events/${event.slug}`} className="btn">
            Leaderboard de l&apos;événement →
          </Link>{" "}
          <Link href="/events" className="btn">
            ← Tous les événements
          </Link>
        </p>
      </div>

      <Footer />
    </>
  );
}
