"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DIFFICULTY_LABELS,
  type ChallengeSummary,
  type EventDetail,
  type MeResponse,
} from "@ft-root/shared";
import { api } from "~/lib/api";
import { useEvents } from "~/lib/events-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  const { refresh: refreshEvents } = useEvents();

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [allUsers, setAllUsers] = useState<MeResponse[]>([]);
  const [allChallenges, setAllChallenges] = useState<ChallengeSummary[]>([]);

  // Identity form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [image, setImage] = useState<File | null>(null);

  // Selection state for add-member and add-challenge dropdowns
  const [pickedLogin, setPickedLogin] = useState("");
  const [pickedChallenge, setPickedChallenge] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [e, u, c] = await Promise.all([
      api<EventDetail>(`/events/${slug}`),
      api<MeResponse[]>("/users"),
      api<ChallengeSummary[]>("/challenges"),
    ]);
    setEvent(e);
    setAllUsers(u);
    setAllChallenges(c);
    setName(e.name);
    setDescription(e.description);
    setStartsAt(toLocalInput(e.startsAt));
    setEndsAt(toLocalInput(e.endsAt));
  }, [slug]);

  useEffect(() => {
    reload().catch(() => setError("Événement introuvable"));
  }, [reload]);

  async function saveMeta(e: React.FormEvent) {
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
    if (image) fd.append("image", image);

    setSavingMeta(true);
    try {
      await api(`/events/${slug}`, { method: "PATCH", body: fd });
      await Promise.all([reload(), refreshEvents()]);
      setImage(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la modification",
      );
    } finally {
      setSavingMeta(false);
    }
  }

  async function addMember() {
    if (!pickedLogin) return;
    setError(null);
    setPendingAction(`member:add:${pickedLogin}`);
    try {
      await api(`/events/${slug}/members`, {
        method: "POST",
        body: JSON.stringify({ login: pickedLogin }),
      });
      setPickedLogin("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeMember(userId: number, login: string) {
    if (!confirm(`Retirer ${login} de l'événement ?`)) return;
    setError(null);
    setPendingAction(`member:del:${userId}`);
    try {
      await api(`/events/${slug}/members/${userId}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPendingAction(null);
    }
  }

  async function addChallenge() {
    if (!pickedChallenge) return;
    setError(null);
    setPendingAction(`chal:add:${pickedChallenge}`);
    try {
      await api(`/events/${slug}/challenges`, {
        method: "POST",
        body: JSON.stringify({ challengeSlug: pickedChallenge }),
      });
      setPickedChallenge("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeChallenge(challengeSlug: string, title: string) {
    if (
      !confirm(
        `Retirer "${title}" de l'événement ?\n\nLes points déjà crédités à ce challenge restent acquis pour les membres.`,
      )
    )
      return;
    setError(null);
    setPendingAction(`chal:del:${challengeSlug}`);
    try {
      await api(
        `/events/${slug}/challenges/${encodeURIComponent(challengeSlug)}`,
        { method: "DELETE" },
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Supprimer définitivement l'événement "${name}" ?\n\nImage, membres et associations aux challenges sont supprimés. Les scores acquis par les utilisateurs restent.`,
      )
    )
      return;
    setError(null);
    setDeleting(true);
    try {
      await api(`/events/${slug}`, { method: "DELETE" });
      await refreshEvents();
      router.push("/admin/events");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la suppression",
      );
      setDeleting(false);
    }
  }

  if (error && !event) {
    return (
      <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>{error}</p>
    );
  }

  if (!event) {
    return <p className="callback-mono callback-blink">Chargement</p>;
  }

  const memberIds = new Set(event.members.map((m) => m.user.id));
  const challengeIds = new Set(event.challenges.map((c) => c.challenge.id));
  const memberCandidates = allUsers.filter((u) => !memberIds.has(u.id));
  const challengeCandidates = allChallenges.filter(
    (c) => !challengeIds.has(c.id),
  );

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          {event.name}
        </p>
        <Link
          href={`/leaderboard/events/${event.slug}`}
          className="btn"
          target="_blank"
        >
          Voir le leaderboard ↗
        </Link>
      </div>

      {error && <div className="login-error">{error}</div>}

      {/* ── Identity form ──────────────────────────────────────── */}
      <form className="form" onSubmit={saveMeta} style={{ marginBottom: "3rem" }}>
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
          <span>Description (optionnelle)</span>
          <textarea
            value={description}
            rows={4}
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

        <div className="form-field">
          <span>Image</span>
          {event.imageUrl && (
            <div className="event-current-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_URL}${event.imageUrl}`}
                alt="image actuelle"
              />
              <small>image actuelle</small>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <small>
            {event.imageUrl
              ? "Choisir un fichier pour remplacer l'image actuelle."
              : "Optionnel."}
          </small>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingMeta}
          >
            {savingMeta ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>

      {/* ── Members ────────────────────────────────────────────── */}
      <p className="section-title">Membres ({event.members.length})</p>
      <p
        style={{
          color: "var(--muted)",
          fontFamily: "var(--mono)",
          fontSize: 12,
          marginBottom: "1rem",
        }}
      >
        // les scores se mettent à jour quand un membre valide un challenge de
        l&apos;événement pendant la durée
      </p>

      <div className="event-add-row">
        <select
          value={pickedLogin}
          onChange={(e) => setPickedLogin(e.target.value)}
        >
          <option value="">— sélectionner un utilisateur —</option>
          {memberCandidates.map((u) => (
            <option key={u.id} value={u.login}>
              {u.login}
              {u.displayName ? ` (${u.displayName})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          onClick={addMember}
          disabled={!pickedLogin || pendingAction !== null}
        >
          + Ajouter
        </button>
      </div>

      {event.members.length === 0 ? (
        <div className="empty-card" style={{ marginTop: "1rem" }}>
          <p className="empty-tag">// no_members</p>
          <p>Aucun membre.</p>
        </div>
      ) : (
        <div className="member-table" style={{ marginTop: "1rem" }}>
          <div className="member-row member-row-head">
            <div>utilisateur</div>
            <div className="member-score-col">score</div>
            <div className="member-actions-col"></div>
          </div>
          {event.members.map((m) => (
            <div key={m.id} className="member-row">
              <Link
                href={`/admin/users/${m.user.login}`}
                className="member-login"
              >
                {m.user.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.avatarUrl} alt="" />
                )}
                <span>
                  {m.user.login}
                  {m.user.displayName && <small> {m.user.displayName}</small>}
                </span>
              </Link>
              <div className="member-score-col member-score-readonly">
                {m.score}
              </div>
              <div className="member-actions-col">
                <button
                  type="button"
                  className="form-slot-remove"
                  onClick={() => removeMember(m.user.id, m.user.login)}
                  disabled={pendingAction === `member:del:${m.user.id}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Challenges ────────────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: "2.5rem" }}>
        Challenges de l&apos;événement ({event.challenges.length})
      </p>
      <p
        style={{
          color: "var(--muted)",
          fontFamily: "var(--mono)",
          fontSize: 12,
          marginBottom: "1rem",
        }}
      >
        // seuls ces challenges donnent des points pour cet événement, et
        seulement pendant sa durée
      </p>

      <div className="event-add-row">
        <select
          value={pickedChallenge}
          onChange={(e) => setPickedChallenge(e.target.value)}
        >
          <option value="">— sélectionner un challenge —</option>
          {challengeCandidates.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.category?.name} · {c.title} (+{c.score})
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary"
          onClick={addChallenge}
          disabled={!pickedChallenge || pendingAction !== null}
        >
          + Ajouter
        </button>
      </div>

      {event.challenges.length === 0 ? (
        <div className="empty-card" style={{ marginTop: "1rem" }}>
          <p className="empty-tag">// no_challenges</p>
          <p>Aucun challenge associé à cet événement.</p>
        </div>
      ) : (
        <div className="solves-table" style={{ marginTop: "1rem" }}>
          <div className="solve-row solve-row-head">
            <div>challenge</div>
            <div>catégorie</div>
            <div>difficulté</div>
            <div className="solve-num">pts</div>
            <div></div>
            <div className="solve-actions"></div>
          </div>
          {event.challenges.map((ec) => (
            <div key={ec.id} className="solve-row">
              <Link
                href={`/admin/challenges/${ec.challenge.slug}/edit`}
                className="solve-title"
              >
                {ec.challenge.title}
              </Link>
              <div className="solve-dim">{ec.challenge.category.name}</div>
              <div>
                <span className={`diff-badge diff-${ec.challenge.difficulty}`}>
                  {DIFFICULTY_LABELS[ec.challenge.difficulty]}
                </span>
              </div>
              <div className="solve-num">+{ec.challenge.score}</div>
              <div></div>
              <div className="solve-actions">
                <button
                  type="button"
                  className="form-slot-remove"
                  onClick={() =>
                    removeChallenge(ec.challenge.slug, ec.challenge.title)
                  }
                  disabled={pendingAction === `chal:del:${ec.challenge.slug}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Danger zone ───────────────────────────────────────── */}
      <div className="danger-zone">
        <p className="danger-zone-title">// danger_zone</p>
        <p className="danger-zone-text">
          Supprime l&apos;événement, son image, ses associations de membres et
          de challenges. Les scores globaux acquis par les utilisateurs ne sont
          pas retirés.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? "Suppression..." : "Supprimer l'événement"}
        </button>
      </div>
    </>
  );
}
