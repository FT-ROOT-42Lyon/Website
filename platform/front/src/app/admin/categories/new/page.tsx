"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useCategories } from "~/lib/categories-context";

export default function NewCategoryPage() {
  const router = useRouter();
  const { refresh } = useCategories();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exploitDescription, setExploitDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ name, description, exploitDescription }),
      });
      await refresh();
      router.push("/admin/categories");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="section-title">Nouvelle catégorie</p>

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
            placeholder="ex: Cryptographie"
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
            placeholder="Une description de quelques phrases présentant la catégorie."
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
            placeholder="ex: AES, RSA, hash collisions"
          />
          <small>Liste les familles d&apos;exploits abordées, séparées par des virgules.</small>
        </label>

        {error && <div className="login-error">{error}</div>}

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "Création..." : "Créer →"}
          </button>
        </div>
      </form>
    </>
  );
}
