"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Category } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useCategories } from "~/lib/categories-context";

export default function EditCategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { refresh } = useCategories();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exploitDescription, setExploitDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<Category>(`/categories/${slug}`)
      .then((c) => {
        setName(c.name);
        setDescription(c.description);
        setExploitDescription(c.exploitDescription);
        setLoaded(true);
      })
      .catch(() => setError("Catégorie introuvable"));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api<Category>(`/categories/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description, exploitDescription }),
      });
      await refresh();
      router.push("/admin/categories");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la modification",
      );
      setSubmitting(false);
    }
  }

  if (error && !loaded) {
    return (
      <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>{error}</p>
    );
  }

  if (!loaded) {
    return <p className="callback-mono callback-blink">Chargement</p>;
  }

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Modifier la catégorie
        </p>
        <code>{slug}</code>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nom</span>
          <input
            type="text"
            value={name}
            required
            minLength={2}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            required
            rows={4}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Exploits (résumé court)</span>
          <input
            type="text"
            value={exploitDescription}
            required
            maxLength={200}
            onChange={(e) => setExploitDescription(e.target.value)}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "Enregistrement..." : "Enregistrer →"}
          </button>
        </div>
      </form>
    </>
  );
}
