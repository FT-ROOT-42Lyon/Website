"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Event } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useEvents } from "~/lib/events-context";
import { useBrackets } from "~/lib/brackets-context";

export default function NewEventPage() {
  const router = useRouter();
  const { refresh } = useEvents();
  const { brackets } = useBrackets();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [bracketSlug, setBracketSlug] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("La date de fin doit être après la date de début");
      return;
    }

    const fd = new FormData();
    fd.append("name", name);
    fd.append("description", description);
    // datetime-local gives a "YYYY-MM-DDTHH:MM" local string; normalize to ISO.
    fd.append("startsAt", new Date(startsAt).toISOString());
    fd.append("endsAt", new Date(endsAt).toISOString());
    if (bracketSlug) fd.append("bracketSlug", bracketSlug);
    if (image) fd.append("image", image);

    setSubmitting(true);
    try {
      const created = await api<Event>("/events", {
        method: "POST",
        body: fd,
      });
      await refresh();
      router.push(`/admin/events/${created.slug}/edit`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="section-title">Nouvel événement</p>

      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Nom</span>
          <input
            type="text"
            value={name}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: CTF Hiver 2026"
          />
        </label>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            required
            rows={5}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Présentation de l'événement."
          />
        </label>

        <div className="form-grid-2">
          <label className="form-field">
            <span>Début</span>
            <input
              type="datetime-local"
              value={startsAt}
              required
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Fin</span>
            <input
              type="datetime-local"
              value={endsAt}
              required
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>

        <label className="form-field">
          <span>Bracket associé (optionnel)</span>
          <select
            value={bracketSlug}
            onChange={(e) => setBracketSlug(e.target.value)}
          >
            <option value="">— aucun —</option>
            {brackets.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <small>
            Les utilisateurs du bracket verront leur score crédité pour les
            challenges validés.
          </small>
        </label>

        <label className="form-field">
          <span>Image (optionnel)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          {image && (
            <small>Sélectionné : {image.name}</small>
          )}
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
