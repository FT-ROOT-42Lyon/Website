"use client";

import Link from "next/link";
import { useAuth } from "~/lib/auth-context";

export default function HomePage() {
  const { me, loading } = useAuth();

  return (
    <>
      <section className="hero">
        <h1>
          ft_<span>root</span>
        </h1>
        <p className="hero-sub">42Lyon — Plateforme événementielle</p>
        <p className="hero-desc">
          Bienvenue sur la plateforme du club ft_root. Inscriptions, CTF,
          workshops et autres événements du club seront accessibles ici.
        </p>
      </section>

      <div className="section">
        <p className="section-title">Accès rapide</p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {loading ? null : me ? (
            <>
              <Link href="/challenges" className="btn btn-primary">
                Voir les challenges →
              </Link>
              <Link href="/leaderboard" className="btn">
                Voir le leaderboard →
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Se connecter avec 42 →
            </Link>
          )}
        </div>
      </div>

      <footer>
        <span>ft_root</span> — Club Cybersécurité 42Lyon
      </footer>
    </>
  );
}
