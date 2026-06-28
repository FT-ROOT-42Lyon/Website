"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DIFFICULTY_LABELS,
  type Category,
  type ChallengeSummary,
} from "@ft-root/shared";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { useCategories } from "~/lib/categories-context";

export default function CategoryPage() {
  const { category: slug } = useParams<{ category: string }>();
  const { me, loading: authLoading } = useAuth();
  const { categories } = useCategories();
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cat = await api<Category>(`/categories/${slug}`);
        if (cancelled) return;
        setCategory(cat);
        const list = await api<ChallengeSummary[]>(
          `/challenges/by-category/${slug}`,
        );
        if (cancelled) return;
        setChallenges(list);
      } catch {
        if (!cancelled) setError("Catégorie introuvable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, me, authLoading, router]);

  if (authLoading || !me) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="callback">
        <p className="callback-mono" style={{ color: "var(--red)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  return (
    <>
      <section className="hero">
        <h1>
          <span>{category.name}</span>
        </h1>
        <p className="hero-sub">// {category.exploitDescription}</p>
        <p className="hero-desc">{category.description}</p>
      </section>

      <div className="section">
        <p className="section-title">Challenges</p>

        {challenges === null ? (
          <p className="callback-mono callback-blink">Chargement</p>
        ) : challenges.length === 0 ? (
          <div className="empty-card">
            <p className="empty-tag">// no_data</p>
            <p>
              Aucun challenge n&apos;est encore publié dans cette catégorie.
              Les sujets seront ajoutés par les organisateurs.
            </p>
          </div>
        ) : (
          <div className="chal-list">
            <div className="chal-list-row chal-list-head">
              <div>statut</div>
              <div>titre</div>
              <div>difficulté</div>
              <div className="chal-list-score">score</div>
            </div>
            {challenges.map((c) => (
              <Link
                key={c.slug}
                href={`/challenges/${category.slug}/${c.slug}`}
                className={`chal-list-row chal-list-link ${c.solved ? "is-solved" : "is-unsolved"}`}
              >
                <div className="chal-list-status">
                  {c.solved ? "✓" : "✗"}
                </div>
                <div className="chal-list-title">{c.title}</div>
                <div>
                  <span className={`diff-badge diff-${c.difficulty}`}>
                    {DIFFICULTY_LABELS[c.difficulty]}
                  </span>
                </div>
                <div className="chal-list-score">{c.score} pts</div>
              </Link>
            ))}
          </div>
        )}

        <p className="section-title" style={{ marginTop: "3rem" }}>
          Autres catégories
        </p>
        <div className="cards">
          {categories
            .filter((c) => c.slug !== category.slug)
            .map((c) => (
              <Link
                key={c.slug}
                href={`/challenges/${c.slug}`}
                className="card card-link-block"
              >
                <p className="card-tag">{c.exploitDescription}</p>
                <h3>{c.name}</h3>
                <span className="card-link">Ouvrir →</span>
              </Link>
            ))}
        </div>
      </div>

      <footer>
        <span>ft_root</span> — Club Cybersécurité 42Lyon
      </footer>
    </>
  );
}
