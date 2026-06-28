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
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer définitivement la catégorie "${name}" ?\n\nL'opération échouera si des challenges y sont encore rattachés.`,
      )
    )
      return;

    setError(null);
    setDeleting(true);
    try {
      await api(`/categories/${slug}`, { method: "DELETE" });
      await refresh();
      router.push("/admin/categories");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la suppression",
      );
      setDeleting(false);
    }
  }

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
          <span>Description (optionnelle)</span>
          <textarea
            value={description}
            rows={4}
            maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Exploits (optionnel, résumé court)</span>
          <input
            type="text"
            value={exploitDescription}
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

      <div className="danger-zone">
        <p className="danger-zone-title">// danger_zone</p>
        <p className="danger-zone-text">
          Supprimer cette catégorie. Refusé si elle contient encore des
          challenges — déplace-les ou supprime-les d&apos;abord.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Suppression..." : "Supprimer la catégorie"}
        </button>
      </div>
    </>
  );
}
