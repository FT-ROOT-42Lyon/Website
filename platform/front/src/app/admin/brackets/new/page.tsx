"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Bracket } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useBrackets } from "~/lib/brackets-context";

export default function NewBracketPage() {
  const router = useRouter();
  const { refresh } = useBrackets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api<Bracket>("/brackets", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      await refresh();
      router.push(`/admin/brackets/${created.slug}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="section-title">Nouveau bracket</p>

      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nom</span>
          <input
            type="text"
            value={name}
            required
            minLength={2}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: CTF Hiver 2026"
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
            placeholder="Présentation rapide du bracket / de l'événement."
          />
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
