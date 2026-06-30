"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DIFFICULTY_LABELS, type ChallengeSummary } from "@ft-root/shared";
import { api } from "~/lib/api";
import { SearchBar, searchMatch } from "~/components/SearchBar";

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<ChallengeSummary[]>("/challenges")
      .then(setChallenges)
      .catch(() => setError("Impossible de charger les challenges"));
  }, []);

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Challenges
        </p>
        <Link href="/admin/challenges/new" className="btn btn-primary">
          + Nouveau challenge
        </Link>
      </div>

      {error && (
        <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>
          {error}
        </p>
      )}

      {!challenges ? (
        <p className="callback-mono callback-blink">Chargement</p>
      ) : challenges.length === 0 ? (
        <div className="empty-card">
          <p className="empty-tag">// no_data</p>
          <p>Aucun challenge sur la plateforme pour l&apos;instant.</p>
        </div>
      ) : (
        <>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="rechercher un challenge..."
        />
        <div className="chal-admin-table">
          <div className="chal-admin-row chal-admin-head">
            <div>titre</div>
            <div>catégorie</div>
            <div>difficulté</div>
            <div className="chal-admin-num">score</div>
            <div className="chal-admin-num">ressources</div>
          </div>
          {challenges
            .filter((c) => searchMatch([c.title, c.description, c.category?.name], query))
            .map((c) => (
            <Link
              key={c.id}
              href={`/admin/challenges/${c.slug}/edit`}
              className="chal-admin-row chal-admin-link"
            >
              <div className="chal-admin-title">
                {c.title}
                {!c.hasFlag && (
                  <span
                    className="chal-no-flag"
                    title="aucun flag configuré"
                    style={{ marginLeft: 8 }}
                  >
                    !
                  </span>
                )}
              </div>
              <div className="chal-admin-dim">{c.category?.name ?? "—"}</div>
              <div>
                <span className={`diff-badge diff-${c.difficulty}`}>
                  {DIFFICULTY_LABELS[c.difficulty]}
                </span>
              </div>
              <div className="chal-admin-num">{c.score}</div>
              <div className="chal-admin-num">{c.resourceCount ?? 0}</div>
            </Link>
          ))}
        </div>
        </>
      )}
    </>
  );
}
