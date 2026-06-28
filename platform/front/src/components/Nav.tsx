"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import { useCategories } from "~/lib/categories-context";
import { useBrackets } from "~/lib/brackets-context";

export function Nav() {
  const { me, loading, logout } = useAuth();
  const { categories } = useCategories();
  const { brackets } = useBrackets();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        <span>
          ft_<b>root</b>
        </span>
      </Link>

      <div className="nav-links">
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
                {brackets.length === 0 ? (
                  <span className="nav-dropdown-empty">aucun bracket</span>
                ) : (
                  brackets.map((b) => (
                    <Link
                      key={b.slug}
                      href={`/leaderboard/brackets/${b.slug}`}
                    >
                      {b.name}
                    </Link>
                  ))
                )}
              </div>
            </div>

            <Link href={`/profile/${me.login}`}>Profil</Link>
            {me.isStaff && <Link href="/admin">Admin</Link>}
            <button onClick={handleLogout}>Déconnexion</button>
          </>
        ) : (
          <Link href="/login">Connexion</Link>
        )}
      </div>
    </nav>
  );
}
