"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import { useCategories } from "~/lib/categories-context";
import { isEventActive, useEvents } from "~/lib/events-context";

export function Nav() {
  const { me, loading, logout } = useAuth();
  const { categories } = useCategories();
  const { events } = useEvents();
  const router = useRouter();
  const activeEvents = events.filter((e) => isEventActive(e));

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <nav className="nav">
      <div className="nav-left">
        <Link href="/" className="nav-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.webp" alt="ft_root" />
          <span>
            ft<b>_</b>root
          </span>
        </Link>
      </div>

      <div className="nav-center">
        {loading ? null : me ? (
          <>
            <div className="nav-dropdown">
              <Link href="/challenges" className="nav-dropdown-trigger">
                Challenges <span className="nav-chevron">▾</span>
              </Link>
              <div className="nav-dropdown-menu">
                <Link href="/challenges" className="nav-dropdown-head">
                  Toutes les catégories
                </Link>
                {categories.map((c) => (
                  <Link key={c.slug} href={`/challenges/${c.slug}`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="nav-dropdown">
              <Link href="/leaderboard" className="nav-dropdown-trigger">
                Leaderboard <span className="nav-chevron">▾</span>
              </Link>
              <div className="nav-dropdown-menu">
                <Link href="/leaderboard" className="nav-dropdown-head">
                  Global
                </Link>
                {events.length === 0 ? (
                  <span className="nav-dropdown-empty">aucun événement</span>
                ) : (
                  events.map((e) => (
                    <Link
                      key={e.slug}
                      href={`/leaderboard/events/${e.slug}`}
                    >
                      {e.name}
                    </Link>
                  ))
                )}
              </div>
            </div>

            <div className="nav-dropdown">
              <Link href="/events" className="nav-dropdown-trigger">
                Événements <span className="nav-chevron">▾</span>
              </Link>
              <div className="nav-dropdown-menu">
                <Link href="/events" className="nav-dropdown-head">
                  Tous les événements
                </Link>
                {activeEvents.length === 0 ? (
                  <span className="nav-dropdown-empty">aucun en cours</span>
                ) : (
                  activeEvents.map((e) => (
                    <Link key={e.slug} href={`/events/${e.slug}`}>
                      {e.name}
                    </Link>
                  ))
                )}
              </div>
            </div>

            <Link href={`/profile/${me.login}`}>Profil</Link>
            {me.isStaff && <Link href="/admin">Admin</Link>}
          </>
        ) : null}
      </div>

      <div className="nav-right">
        {loading ? null : me ? (
          <button onClick={handleLogout}>Déconnexion</button>
        ) : (
          <Link href="/login">Connexion</Link>
        )}
      </div>
    </nav>
  );
}
