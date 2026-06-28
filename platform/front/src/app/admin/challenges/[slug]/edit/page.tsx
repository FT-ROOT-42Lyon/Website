"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Challenge,
  type ChallengeResource,
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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function EditChallengePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { categories } = useCategories();

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [score, setScore] = useState("100");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [flag, setFlag] = useState("");
  const [hasFlag, setHasFlag] = useState(false);
  const [existing, setExisting] = useState<ChallengeResource[]>([]);
  const [keepIds, setKeepIds] = useState<number[]>([]);
  const [files, setFiles] = useState<FileSlot[]>([]);
  const [links, setLinks] = useState<LinkSlot[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<Challenge>(`/challenges/${slug}`)
      .then((c) => {
        setTitle(c.title);
        setDescription(c.description);
        setCategorySlug(c.category.slug);
        setScore(String(c.score));
        setDifficulty(c.difficulty);
        setHasFlag(c.hasFlag);
        setExisting(c.resources);
        setKeepIds(c.resources.map((r) => r.id));
        setLoaded(true);
      })
      .catch(() => setError("Challenge introuvable"));
  }, [slug]);

  function toggleKeep(id: number) {
    setKeepIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

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

    for (const l of links) {
      if (!l.label.trim() || !l.url.trim()) {
        setError("Chaque nouveau lien doit avoir un label et une URL");
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
    // Empty flag = keep the existing hash; only set if admin typed a new one.
    if (flag.trim()) fd.append("flag", flag);
    fd.append("keepResourceIds", JSON.stringify(keepIds));
    fd.append("newLinks", JSON.stringify(links));
    fd.append("fileLabels", JSON.stringify(files.map((f) => f.label)));
    files.forEach((f) => fd.append("files", f.file));

    setSubmitting(true);
    try {
      await api(`/challenges/${slug}`, { method: "PATCH", body: fd });
      router.push("/admin/challenges");
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

  const existingFiles = existing.filter((r) => r.type === "FILE");
  const existingLinks = existing.filter((r) => r.type === "LINK");

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Modifier le challenge
        </p>
        <code>{slug}</code>
      </div>

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
            onChange={(e) => setFlag(e.target.value)}
            placeholder={hasFlag ? "•••••••• (laisser vide pour ne pas changer)" : "ex: ft_root{exemple}"}
            autoComplete="off"
            spellCheck={false}
          />
          <small>
            {hasFlag
              ? "Un flag est déjà configuré. Saisir un nouveau flag écrasera l'ancien."
              : "Aucun flag configuré — les utilisateurs ne peuvent pas encore valider ce challenge."}
          </small>
        </label>

        {existing.length > 0 && (
          <div className="form-field">
            <span>Ressources existantes</span>
            <small>Décoche celles à supprimer.</small>
            <div className="form-slots">
              {[...existingFiles, ...existingLinks].map((r) => {
                const kept = keepIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={`form-slot existing-slot${kept ? "" : " existing-slot-removed"}`}
                  >
                    <input
                      type="checkbox"
                      checked={kept}
                      onChange={() => toggleKeep(r.id)}
                    />
                    <span className="existing-label">
                      <span className="existing-tag">
                        {r.type === "FILE" ? "file" : "link"}
                      </span>{" "}
                      {r.label}
                    </span>
                    {r.type === "FILE" ? (
                      <a
                        href={`${API_URL}${r.href}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="existing-link"
                      >
                        ↓
                      </a>
                    ) : (
                      <a
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="existing-link"
                      >
                        ↗
                      </a>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="form-field">
          <span>Ajouter des fichiers</span>
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
            <span>Ajouter des liens</span>
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
            {submitting ? "Enregistrement..." : "Enregistrer →"}
          </button>
        </div>
      </form>
    </>
  );
}
