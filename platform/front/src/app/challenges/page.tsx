"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import { useCategories } from "~/lib/categories-context";
import { Footer } from "~/components/Footer";

export default function ChallengesIndexPage() {
  const { me, loading: authLoading } = useAuth();
  const { categories, loading: catLoading } = useCategories();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!me) router.replace("/login");
  }, [me, authLoading, router]);

  if (authLoading || !me) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  return (
    <>
      <section className="hero">
        <h1>Catégories</h1>
        <p className="hero-sub">// challenges par domaine</p>
        <p className="hero-desc">
          Sélectionne une catégorie pour accéder à ses challenges. Les
          challenges restent sur la plateforme indéfiniment ; les événements
          piochent dedans ou ajoutent leurs propres sujets exclusifs.
        </p>
      </section>

      <div className="section">
        <p className="section-title">Catégories</p>

        {catLoading ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : (
          <div className="cards">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/challenges/${c.slug}`}
                className="card card-link-block"
              >
                <p className="card-tag">{c.exploitDescription}</p>
                <h3>{c.name}</h3>
                <p>{c.description}</p>
                <span className="card-link">Ouvrir →</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
