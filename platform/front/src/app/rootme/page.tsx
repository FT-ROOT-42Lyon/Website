"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import { useRootme } from "~/lib/rootme-context";
import { Footer } from "~/components/Footer";
import { SearchBar, searchMatch } from "~/components/SearchBar";

// Section dedicated to Root-Me content. The data sits in the regular
// categories/challenges tables (rows whose `rootmeId` is non-null), so we
// just filter `useCategories` and reuse the normal `/challenges/[slug]`
// page on click.
export default function RootmeIndexPage() {
  const { me, loading: authLoading } = useAuth();
  const { categories, loading } = useRootme();
  const router = useRouter();
  const [query, setQuery] = useState("");

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

  const filtered = categories.filter((c) =>
    searchMatch([c.name, c.description], query),
  );

  return (
    <>
      <section className="hero">
        <h1>Root-Me</h1>
        <p className="hero-sub">// catalogue miroir</p>
        <p className="hero-desc">
          Catégories et challenges synchronisés depuis{" "}
          <a
            href="https://www.root-me.org/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--red)", textDecoration: "underline" }}
          >
            root-me.org
          </a>
          . Les challenges Root-Me utilisent le même scoring que les
          challenges natifs et peuvent être ajoutés aux événements. Lie ton
          compte depuis ton profil pour faire remonter tes validations.
        </p>
      </section>

      <div className="section">
        <p className="section-title">Catégories</p>

        {loading ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : categories.length === 0 ? (
          <div className="empty-card">
            <p className="empty-tag">// no_data</p>
            <p>
              Aucune catégorie Root-Me synchronisée. Le staff peut lancer une
              synchronisation depuis le panneau admin.
            </p>
          </div>
        ) : (
          <>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="rechercher une catégorie..."
            />
            {filtered.length === 0 ? (
              <p
                style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}
              >
                Aucune catégorie ne correspond.
              </p>
            ) : (
              <div className="cards">
                {filtered.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/challenges/${c.slug}`}
                    className="card card-link-block"
                  >
                    <p className="card-tag">// root-me</p>
                    <h3>{c.name.replace(/^RootMe - /, "")}</h3>
                    {c.description && <p>{c.description}</p>}
                    <span className="card-link">
                      Ouvrir ({c.challengeCount}) →
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </>
  );
}
