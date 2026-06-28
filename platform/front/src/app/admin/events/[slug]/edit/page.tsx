"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Event } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useEvents } from "~/lib/events-context";
import { useBrackets } from "~/lib/brackets-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// "2026-05-04T18:00:00.000Z" → "2026-05-04T20:00" in local time, as required
// by <input type="datetime-local">.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function EditEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { refresh } = useEvents();
  const { brackets } = useBrackets();

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [bracketSlug, setBracketSlug] = useState("");
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<Event>(`/events/${slug}`)
      .then((e) => {
        setName(e.name);
        setDescription(e.description);
        setStartsAt(toLocalInput(e.startsAt));
        setEndsAt(toLocalInput(e.endsAt));
        setBracketSlug(e.bracket?.slug ?? "");
        setCurrentImage(e.imageUrl);
        setLoaded(true);
      })
      .catch(() => setError("Événement introuvable"));
  }, [slug]);

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
    fd.append("startsAt", new Date(startsAt).toISOString());
    fd.append("endsAt", new Date(endsAt).toISOString());
    // Always send bracketSlug — empty string clears the association.
    fd.append("bracketSlug", bracketSlug);
    if (image) fd.append("image", image);

    setSubmitting(true);
    try {
      await api(`/events/${slug}`, { method: "PATCH", body: fd });
      await refresh();
      router.push("/admin/events");
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
          Modifier l&apos;événement
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
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            required
            rows={5}
            onChange={(e) => setDescription(e.target.value)}
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
        </label>

        <div className="form-field">
          <span>Image</span>
          {currentImage && (
            <div className="event-current-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${API_URL}${currentImage}`} alt="image actuelle" />
              <small>image actuelle</small>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <small>
            {currentImage
              ? "Choisir un fichier pour remplacer l'image actuelle."
              : "Optionnel."}
          </small>
        </div>

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
