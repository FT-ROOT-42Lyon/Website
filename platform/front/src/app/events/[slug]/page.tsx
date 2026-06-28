"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Event } from "@ft-root/shared";
import { api } from "~/lib/api";
import { isEventActive } from "~/lib/events-context";
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
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Event>(`/events/${slug}`)
      .then(setEvent)
      .catch(() => setError("Événement introuvable"));
  }, [slug]);

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

  const active = isEventActive(event);
  const now = Date.now();
  const status =
    active
      ? "en cours"
      : Date.parse(event.startsAt) > now
        ? "à venir"
        : "terminé";

  return (
    <>
      <section className="hero">
        <h1>{event.name}</h1>
        <p className="hero-sub">// {status}</p>
        {event.bracket && (
          <p className="hero-sub" style={{ marginTop: "-0.5rem" }}>
            bracket — {event.bracket.name}
          </p>
        )}
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
          {event.bracket && (
            <div>
              bracket:{" "}
              <span>
                <Link href={`/leaderboard/brackets/${event.bracket.slug}`}>
                  {event.bracket.name} ↗
                </Link>
              </span>
            </div>
          )}
        </div>

        <p className="section-title" style={{ marginTop: "3rem" }}>
          Description
        </p>
        <div className="challenge-desc">{event.description}</div>

        <p style={{ marginTop: "3rem" }}>
          <Link href="/events" className="btn">
            ← Tous les événements
          </Link>
        </p>
      </div>

      <Footer />
    </>
  );
}
