"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Category } from "@ft-root/shared";
import { api } from "~/lib/api";
import { SearchBar, searchMatch } from "~/components/SearchBar";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<Category[]>("/categories")
      .then(setCategories)
      .catch(() => setError("Impossible de charger les catégories"));
  }, []);

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Catégories
        </p>
        <Link href="/admin/categories/new" className="btn btn-primary">
          + Nouvelle catégorie
        </Link>
      </div>

      {error && (
        <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>
          {error}
        </p>
      )}

      {!categories ? (
        <p className="callback-mono callback-blink">Chargement</p>
      ) : (
        <>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="rechercher une catégorie..."
        />
        <div className="cat-table cat-table-noslug">
          <div className="cat-row cat-row-head">
            <div>nom</div>
            <div>exploits</div>
            <div className="cat-count-col">challenges</div>
          </div>
          {categories
            .filter((c) => searchMatch([c.name, c.description, c.exploitDescription], query))
            .map((c) => (
            <Link
              key={c.id}
              href={`/admin/categories/${c.slug}/edit`}
              className="cat-row cat-row-link"
            >
              <div>{c.name}</div>
              <div className="cat-dim">{c.exploitDescription}</div>
              <div className="cat-count-col">{c.challengeCount}</div>
            </Link>
          ))}
        </div>
        </>
      )}
    </>
  );
}
