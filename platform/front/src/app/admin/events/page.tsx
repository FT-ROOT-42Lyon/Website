"use client";

import Link from "next/link";
import { isEventActive, useEvents } from "~/lib/events-context";

function formatRange(startsAt: string, endsAt: string): string {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(new Date(startsAt))} → ${fmt.format(new Date(endsAt))}`;
}

export default function AdminEventsPage() {
  const { events, loading } = useEvents();

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Événements
        </p>
        <Link href="/admin/events/new" className="btn btn-primary">
          + Nouvel événement
        </Link>
      </div>

      {loading ? (
        <p className="callback-mono callback-blink">Chargement</p>
      ) : events.length === 0 ? (
        <div className="empty-card">
          <p className="empty-tag">// no_data</p>
          <p>Aucun événement pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="cat-table">
          <div className="cat-row cat-row-head event-admin-row">
            <div>nom</div>
            <div>période</div>
            <div className="cat-count-col">statut</div>
          </div>
          {events.map((e) => {
            const active = isEventActive(e);
            const upcoming = Date.parse(e.startsAt) > Date.now();
            return (
              <Link
                key={e.id}
                href={`/admin/events/${e.slug}/edit`}
                className="cat-row cat-row-link event-admin-row"
              >
                <div>{e.name}</div>
                <div className="cat-dim">
                  {formatRange(e.startsAt, e.endsAt)}
                </div>
                <div className="cat-count-col">
                  {active ? (
                    <span className="event-card-badge">en cours</span>
                  ) : upcoming ? (
                    <span className="event-status-upcoming">à venir</span>
                  ) : (
                    <span className="event-status-past">terminé</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
