"use client";

import Link from "next/link";
import { eventStatus } from "@ft-root/shared";
import { Footer } from "~/components/Footer";
import { useEvents } from "~/lib/events-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function formatRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(startsAt))} → ${fmt.format(new Date(endsAt))}`;
}

export default function HomePage() {
  const { events, loading } = useEvents();

  return (
    <>
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.webp" alt="ft_root" className="hero-logo" />
        <h1>
          ft<span>_</span>root
        </h1>
        <p className="hero-sub">42Lyon — Plateforme événementielle</p>
        <p className="hero-desc">
          Bienvenue sur la plateforme du club ft_root. Inscriptions, CTF,
          workshops et autres événements du club seront accessibles ici.
        </p>
      </section>

      <div className="section home-events-section">
        <p className="section-title">Événements</p>

        {loading ? (
          <p
            className="callback-mono callback-blink"
            style={{ textAlign: "center" }}
          >
            Chargement
          </p>
        ) : events.length === 0 ? (
          <div className="empty-card">
            <p className="empty-tag">// no_data</p>
            <p>Aucun événement publié pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="home-events">
            {events.map((e) => {
              const status = eventStatus(e);
              return (
                <Link
                  key={e.slug}
                  href={`/events/${e.slug}`}
                  className="event-card"
                >
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${API_URL}${e.imageUrl}`} alt={e.name} />
                  ) : (
                    <div className="event-card-placeholder">// no_image</div>
                  )}
                  <div className="event-card-body">
                    <div className="event-card-head">
                      <span className="event-card-date">
                        {formatRange(e.startsAt, e.endsAt)}
                      </span>
                      {status === "active" && (
                        <span className="event-card-badge">en cours</span>
                      )}
                      {status === "past" && (
                        <span className="event-card-badge event-card-badge-past">
                          terminé
                        </span>
                      )}
                    </div>
                    <h3>{e.name}</h3>
                    {e.description && (
                      <p>
                        {e.description.length > 220
                          ? e.description.slice(0, 220) + "..."
                          : e.description}
                      </p>
                    )}
                    <span className="card-link">Ouvrir →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
