"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { UserStats } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { Footer } from "~/components/Footer";
import { ScoreTimeline } from "~/components/charts/ScoreTimeline";
import { DifficultyDonut } from "~/components/charts/DifficultyDonut";
import { CategoryRings } from "~/components/charts/CategoryRings";
import { RootmeLinkCard } from "~/components/RootmeLinkCard";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default function UserProfilePage() {
  const { login } = useParams<{ login: string }>();
  const { me, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for the auth context to finish its initial refresh — otherwise we
    // can fire the request without an access token and 401, which would then
    // bounce a logged-in user to /login (this was the bug reported around
    // opening the profile from the admin panel).
    if (authLoading) return;
    api<UserStats>(`/users/${encodeURIComponent(login)}/stats`)
      .then(setStats)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "";
        if (msg.startsWith("API 401")) {
          router.replace("/login");
        } else {
          setError("Utilisateur introuvable");
        }
      });
  }, [login, authLoading, router]);

  if (error) {
    return (
      <div className="callback">
        <p className="callback-mono" style={{ color: "var(--red)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  const { user, globalRank, totalUsers, events, solves, neighborhood } = stats;
  const isSelf = me?.id === user.id;
  const intraUrl = `https://profile.intra.42.fr/users/${user.login}`;

  return (
    <>
      <div className="section profile-section">
        {/* ── Header card ───────────────────────────────────────────── */}
        <div className="profile-card profile-header">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.login}
              className="profile-avatar-lg"
            />
          ) : (
            <div className="profile-avatar-lg profile-avatar-placeholder">
              {user.login.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="profile-identity">
            <h1>{user.login}</h1>
            <div className="profile-meta-row">
              <span
                className={`role-badge ${user.isStaff ? "role-badge-staff" : ""}`}
              >
                {user.isStaff ? "staff" : "member"}
              </span>
              {user.displayName && (
                <span className="profile-display-name">{user.displayName}</span>
              )}
            </div>
            <p className="profile-since">
              membre depuis {formatDate(user.createdAt)}
            </p>
            <a
              href={intraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-intra-link"
            >
              intra.42.fr/users/{user.login} ↗
            </a>
          </div>

          <div className="profile-stats-corner">
            <div>
              <span className="profile-stat-label">score global</span>
              <strong className="profile-stat-value">{user.score}</strong>
            </div>
            <div>
              <span className="profile-stat-label">classement</span>
              <strong className="profile-stat-value">
                #{globalRank}
                <small> /{totalUsers}</small>
              </strong>
            </div>
            <div>
              <span className="profile-stat-label">challenges</span>
              <strong className="profile-stat-value">{solves.length}</strong>
            </div>
          </div>
        </div>

        {/* ── Root-Me link (self only) ────────────────────────────── */}
        {isSelf && <RootmeLinkCard />}

        {/* ── Event participations ────────────────────────────────── */}
        <div className="profile-card">
          <p className="profile-card-title">Participations</p>
          {events.length === 0 ? (
            <p className="profile-empty">Aucune participation à un événement.</p>
          ) : (
            <div className="bracket-badges">
              {events.map((ev) => (
                <Link
                  key={ev.slug}
                  href={`/leaderboard/events/${ev.slug}`}
                  className="bracket-badge"
                  title={`Rejoint le ${formatDate(ev.joinedAt)}`}
                >
                  <span className="bracket-badge-name">{ev.name}</span>
                  <span className="bracket-badge-score">{ev.score} pts</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Score timeline ───────────────────────────────────────── */}
        <div className="profile-card">
          <p className="profile-card-title">Évolution du score</p>
          <p className="profile-card-hint">
            Chaque point = un challenge validé. Survole pour le détail, clique
            pour ouvrir la page du challenge.
          </p>
          <ScoreTimeline
            series={[
              {
                user: {
                  id: user.id,
                  login: user.login,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                },
                points: solves,
              },
            ]}
          />
        </div>

        {/* ── Charts row: donut + rings ─────────────────────────────── */}
        <div className="profile-charts-row">
          <div className="profile-card">
            <p className="profile-card-title">Difficultés validées</p>
            <DifficultyDonut distribution={stats.difficultyDistribution} />
          </div>
          <div className="profile-card">
            <p className="profile-card-title">Progression par catégorie</p>
            <CategoryRings stats={stats.categoryStats} />
          </div>
        </div>

        {/* ── Neighborhood leaderboard ─────────────────────────────── */}
        <div className="profile-card">
          <p className="profile-card-title">Voisinage du classement</p>
          <div className="lb-table">
            <div className="lb-row lb-row-head">
              <div className="lb-rank-col">#</div>
              <div>utilisateur</div>
              <div className="lb-score-col">score</div>
            </div>
            {neighborhood.map((e) => {
              const isMe = e.user.id === user.id;
              return (
                <Link
                  key={e.user.id}
                  href={`/profile/${e.user.login}`}
                  className={`lb-row lb-row-rank-${e.rank <= 3 ? e.rank : "n"} ${isMe ? "lb-row-me" : ""}`}
                >
                  <div className="lb-rank-col">{e.rank}</div>
                  <div className="lb-user">
                    {e.user.avatarUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.user.avatarUrl} alt="" />
                    )}
                    <span>{e.user.login}</span>
                    {isMe && <small className="lb-me-tag">vous</small>}
                  </div>
                  <div className="lb-score-col">{e.score}</div>
                </Link>
              );
            })}
          </div>
        </div>

        {isSelf && (
          <p className="profile-self-note">
            // seul toi vois ton e-mail ({user.email})
          </p>
        )}
      </div>

      <Footer />
    </>
  );
}
