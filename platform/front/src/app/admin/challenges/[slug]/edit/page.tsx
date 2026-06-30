"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Challenge,
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

// A pre-existing resource, editable in place. `href` is the original download
// URL (for FILE) or external URL (for LINK), kept around for the row's link
// icon so admins can still preview the underlying target.
interface ExistingSlot {
  id: number;
  type: "FILE" | "LINK";
  label: string;
  target: string;
  href: string;
  kept: boolean;
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
  const [existingSlots, setExistingSlots] = useState<ExistingSlot[]>([]);
  const [files, setFiles] = useState<FileSlot[]>([]);
  const [links, setLinks] = useState<LinkSlot[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api<Challenge>(`/challenges/${slug}`)
      .then((c) => {
        setTitle(c.title);
        setDescription(c.description);
        setCategorySlug(c.category.slug);
        setScore(String(c.score));
        setDifficulty(c.difficulty);
        setHasFlag(c.hasFlag);
        // Files first, links second, then turn into editable slots.
        const sorted = [
          ...c.resources.filter((r) => r.type === "FILE"),
          ...c.resources.filter((r) => r.type === "LINK"),
        ];
        setExistingSlots(
          sorted.map((r) => ({
            id: r.id,
            type: r.type,
            label: r.label,
            // For LINK, href is also the target. For FILE, target is the
            // on-disk filename (not editable here, but useful to display).
            target: r.type === "LINK" ? r.href : r.href.replace(/^\/uploads\//, ""),
            href: r.href,
            kept: true,
          })),
        );
        setLoaded(true);
      })
      .catch(() => setError("Challenge introuvable"));
  }, [slug]);

  function updateExisting(i: number, patch: Partial<ExistingSlot>) {
    setExistingSlots((cur) =>
      cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
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

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer définitivement le challenge "${title}" ?\n\nCela supprime aussi ses ressources (fichiers compris) et l'historique des solves. Les scores acquis restent inchangés.`,
      )
    )
      return;

    setError(null);
    setDeleting(true);
    try {
      await api(`/challenges/${slug}`, { method: "DELETE" });
      router.push("/admin/challenges");
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

    // Validate edits on existing LINK resources (URL still required + scheme).
    for (const s of existingSlots) {
      if (!s.kept) continue;
      if (s.type === "LINK") {
        if (!s.target.trim()) {
          setError("Chaque lien existant doit avoir une URL");
          return;
        }
        if (!/^https?:\/\//i.test(s.target)) {
          setError("Les URLs doivent commencer par http:// ou https://");
          return;
        }
      }
    }

    const existingResources = existingSlots
      .filter((s) => s.kept)
      .map((s) =>
        s.type === "LINK"
          ? { id: s.id, label: s.label, target: s.target }
          : { id: s.id, label: s.label },
      );

    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    fd.append("categorySlug", categorySlug);
    fd.append("score", score);
    fd.append("difficulty", difficulty);
    if (flag !== "") fd.append("flag", flag);
    fd.append("existingResources", JSON.stringify(existingResources));
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
          <span>Description (optionnelle)</span>
          <textarea
            value={description}
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

        {existingSlots.length > 0 && (
          <div className="form-field">
            <span>Ressources existantes</span>
            <small>
              Modifie le libellé et (pour les liens) l&apos;URL en place.
              Décoche celles à supprimer.
            </small>
            <div className="form-slots">
              {existingSlots.map((s, i) => {
                const isLink = s.type === "LINK";
                const previewHref = isLink ? s.href : `${API_URL}${s.href}`;
                return (
                  <div
                    key={s.id}
                    className={`existing-slot-edit${s.kept ? "" : " existing-slot-removed"}`}
                  >
                    <input
                      type="checkbox"
                      checked={s.kept}
                      onChange={(e) =>
                        updateExisting(i, { kept: e.target.checked })
                      }
                      title={
                        s.kept
                          ? "Décoche pour supprimer cette ressource"
                          : "Coche pour conserver cette ressource"
                      }
                    />
                    <span className="existing-tag">
                      {isLink ? "link" : "file"}
                    </span>
                    <input
                      type="text"
                      value={s.label}
                      placeholder="Libellé du bouton"
                      disabled={!s.kept}
                      onChange={(e) =>
                        updateExisting(i, { label: e.target.value })
                      }
                    />
                    {isLink ? (
                      <input
                        type="url"
                        value={s.target}
                        placeholder="https://..."
                        disabled={!s.kept}
                        onChange={(e) =>
                          updateExisting(i, { target: e.target.value })
                        }
                      />
                    ) : (
                      <span
                        className="existing-filename"
                        title={s.target}
                      >
                        {s.target}
                      </span>
                    )}
                    <a
                      href={previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="existing-link"
                      title={isLink ? "Ouvrir le lien" : "Télécharger"}
                    >
                      {isLink ? "↗" : "↓"}
                    </a>
                  </div>
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

      <div className="danger-zone">
        <p className="danger-zone-title">// danger_zone</p>
        <p className="danger-zone-text">
          Supprime le challenge, ses fichiers et l&apos;historique des
          solves. Les points déjà gagnés par les utilisateurs ne sont
          pas retirés.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Suppression..." : "Supprimer le challenge"}
        </button>
      </div>
    </>
  );
}
