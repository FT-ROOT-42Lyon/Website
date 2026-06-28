"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
} from "@ft-root/shared";
import { api } from "~/lib/api";
import { useCategories } from "~/lib/categories-context";

interface FileSlot {
  file: File;
  label: string;
}

interface LinkSlot {
  label: string;
  url: string;
}

export default function NewChallengePage() {
  const router = useRouter();
  const { categories } = useCategories();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [score, setScore] = useState("100");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [flag, setFlag] = useState("");
  const [files, setFiles] = useState<FileSlot[]>([]);
  const [links, setLinks] = useState<LinkSlot[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setFiles((cur) => [
      ...cur,
      ...picked.map((f) => ({ file: f, label: f.name })),
    ]);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!categorySlug) {
      setError("Sélectionne une catégorie");
      return;
    }
    for (const l of links) {
      if (!l.label.trim() || !l.url.trim()) {
        setError("Chaque lien doit avoir un label et une URL");
        return;
      }
      if (!/^https?:\/\//i.test(l.url)) {
        setError("Les URLs doivent commencer par http:// ou https://");
        return;
      }
    }

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("categorySlug", categorySlug);
    fd.append("score", score);
    fd.append("difficulty", difficulty);
    fd.append("flag", flag);
    fd.append("links", JSON.stringify(links));
    fd.append("fileLabels", JSON.stringify(files.map((f) => f.label)));
    files.forEach((f) => fd.append("files", f.file));

    setSubmitting(true);
    try {
      await api("/challenges", { method: "POST", body: fd });
      router.push("/admin/challenges");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <p className="section-title">Nouveau challenge</p>

      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Titre</span>
          <input
            type="text"
            value={title}
            required
            minLength={2}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            required
            rows={6}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="form-grid-2">
          <label className="form-field">
            <span>Catégorie</span>
            <select
              value={categorySlug}
              required
              onChange={(e) => setCategorySlug(e.target.value)}
            >
              <option value="">— sélectionner —</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Difficulté</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Score (points)</span>
            <input
              type="number"
              min={0}
              step={5}
              value={score}
              required
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
        </div>

        <label className="form-field">
          <span>Flag</span>
          <input
            type="text"
            value={flag}
            required
            minLength={1}
            onChange={(e) => setFlag(e.target.value)}
            placeholder="ex: ft_root{exemple_de_flag}"
            autoComplete="off"
            spellCheck={false}
          />
          <small>
            Le flag est haché (SHA-256) avant stockage. Aucun moyen de le
            récupérer ensuite.
          </small>
        </label>

        <div className="form-field">
          <span>Fichiers (optionnel)</span>
          <input type="file" multiple onChange={handleFiles} />
          {files.length > 0 && (
            <div className="form-slots">
              {files.map((slot, i) => (
                <div key={i} className="form-slot">
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(e) =>
                      setFiles((cur) =>
                        cur.map((s, idx) =>
                          idx === i ? { ...s, label: e.target.value } : s,
                        ),
                      )
                    }
                    placeholder="Libellé du bouton"
                  />
                  <span className="form-slot-meta">{slot.file.name}</span>
                  <button
                    type="button"
                    className="form-slot-remove"
                    onClick={() =>
                      setFiles((cur) => cur.filter((_, idx) => idx !== i))
                    }
                    aria-label="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-field">
          <div className="form-field-head">
            <span>Liens (optionnel)</span>
            <button
              type="button"
              className="btn-small"
              onClick={() =>
                setLinks((cur) => [...cur, { label: "", url: "" }])
              }
            >
              + Lien
            </button>
          </div>
          {links.length > 0 && (
            <div className="form-slots">
              {links.map((slot, i) => (
                <div key={i} className="form-slot">
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(e) =>
                      setLinks((cur) =>
                        cur.map((s, idx) =>
                          idx === i ? { ...s, label: e.target.value } : s,
                        ),
                      )
                    }
                    placeholder="Libellé du bouton"
                  />
                  <input
                    type="url"
                    value={slot.url}
                    onChange={(e) =>
                      setLinks((cur) =>
                        cur.map((s, idx) =>
                          idx === i ? { ...s, url: e.target.value } : s,
                        ),
                      )
                    }
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    className="form-slot-remove"
                    onClick={() =>
                      setLinks((cur) => cur.filter((_, idx) => idx !== i))
                    }
                    aria-label="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
