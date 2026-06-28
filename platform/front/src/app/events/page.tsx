"use client";

import Link from "next/link";
import { eventStatus } from "@ft-root/shared";
import { useEvents } from "~/lib/events-context";
import { Footer } from "~/components/Footer";

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

export default function EventsListPage() {
  const { events, loading } = useEvents();

  return (
    <>
      <section className="hero">
        <h1>Événements</h1>
        <p className="hero-sub">// CTF, workshops, talks</p>
        <p className="hero-desc">
          Tous les événements organisés par le club ft_root, passés, en cours
          et à venir.
        </p>
      </section>

      <div className="section">
        <p className="section-title">Liste</p>

        {loading ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : events.length === 0 ? (
          <div className="empty-card">
            <p className="empty-tag">// no_data</p>
            <p>Aucun événement publié pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="event-grid">
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
                        {e.description.length > 200
                          ? e.description.slice(0, 200) + "..."
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
