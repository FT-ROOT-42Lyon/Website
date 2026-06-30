"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  DIFFICULTY_LABELS,
  type ChallengeSummary,
  type UserStats,
} from "@ft-root/shared";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import { SearchableSelect } from "~/components/SearchableSelect";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminUserEditPage() {
  const { login } = useParams<{ login: string }>();
  const router = useRouter();
  const { me } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [allChallenges, setAllChallenges] = useState<ChallengeSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickedChallenge, setPickedChallenge] = useState("");
  const [pickedSolvedAt, setPickedSolvedAt] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    const [s, c] = await Promise.all([
      api<UserStats>(`/users/${encodeURIComponent(login)}/stats`),
      api<ChallengeSummary[]>("/challenges"),
    ]);
    setStats(s);
    setAllChallenges(c);
  }, [login]);

  useEffect(() => {
    reload().catch(() => setError("Utilisateur introuvable"));
  }, [reload]);

  async function addSolve() {
    if (!pickedChallenge) return;
    setError(null);
    setPendingAction(`add:${pickedChallenge}`);
    try {
      const payload: { challengeSlug: string; solvedAt?: string } = {
        challengeSlug: pickedChallenge,
      };
      // datetime-local gives a local-time string; convert to ISO before send.
      if (pickedSolvedAt) {
        payload.solvedAt = new Date(pickedSolvedAt).toISOString();
      }
      await api(`/users/${encodeURIComponent(login)}/solves`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setPickedChallenge("");
      setPickedSolvedAt("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeSolve(challengeSlug: string) {
    if (
      !confirm(
        `Retirer la validation du challenge "${challengeSlug}" ?\n\nLe score global et les scores d'événement sont décrémentés du montant initialement crédité.`,
      )
    )
      return;
    setError(null);
    setPendingAction(`del:${challengeSlug}`);
    try {
      await api(
        `/users/${encodeURIComponent(login)}/solves/${encodeURIComponent(challengeSlug)}`,
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
    if (!stats) return;
    if (
      !confirm(
        `Supprimer définitivement le compte "${stats.user.login}" ?\n\nSessions, validations de challenges et participations à des événements sont retirées. Les scores globaux des autres utilisateurs ne sont pas modifiés.`,
      )
    )
      return;

    setError(null);
    setDeleting(true);
    try {
      await api(`/users/${encodeURIComponent(stats.user.login)}`, {
        method: "DELETE",
      });
      router.push("/admin/users");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
      setDeleting(false);
    }
  }

  async function setRole(isStaff: boolean) {
    if (!stats) return;
    setError(null);
    setRoleUpdating(true);
    try {
      await api(`/users/${encodeURIComponent(login)}/role`, {
        method: "PATCH",
        body: JSON.stringify({ isStaff }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de rôle");
    } finally {
      setRoleUpdating(false);
    }
  }

  if (error && !stats) {
    return (
      <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>{error}</p>
    );
  }

  if (!stats) {
    return <p className="callback-mono callback-blink">Chargement</p>;
  }

  const { user, events, solves } = stats;
  const solvedSlugs = new Set(solves.map((s) => s.challenge.slug));
  const candidates = allChallenges.filter(
    (c) => c.hasFlag && !solvedSlugs.has(c.slug),
  );
  const isSelf = me?.id === user.id;

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          {user.login}
        </p>
        <Link href={`/profile/${user.login}`} className="btn" target="_blank">
          Voir le profil public ↗
        </Link>
      </div>

      {/* ── Identity card ─────────────────────────────────────────── */}
      <div className="admin-user-card">
        {user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="admin-user-avatar"
          />
        )}
        <div className="admin-user-info">
          <div className="kv-card">
            <div>
              login: <span>{user.login}</span>
            </div>
            <div>
              display_name: <span>{user.displayName ?? "—"}</span>
            </div>
            <div>
              email: <span>{user.email}</span>
            </div>
            <div>
              score global:{" "}
              <span style={{ color: "var(--red)" }}>{user.score}</span>
            </div>
            <div>
              challenges validés: <span>{solves.length}</span>
            </div>
            <div>
              membre depuis: <span>{formatDateTime(user.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="admin-user-role">
          <span className="admin-user-role-label">rôle</span>
          <select
            className={`role-select ${user.isStaff ? "role-staff" : ""}`}
            value={user.isStaff ? "staff" : "member"}
            disabled={isSelf || roleUpdating}
            title={isSelf ? "Tu ne peux pas changer ton propre rôle" : undefined}
            onChange={(e) => setRole(e.target.value === "staff")}
          >
            <option value="member">member</option>
            <option value="staff">staff</option>
          </select>
        </div>
      </div>

      {/* ── Events ────────────────────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: "2.5rem" }}>
        Événements ({events.length})
      </p>
      {events.length === 0 ? (
        <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13 }}>
          Aucun événement. Gère les memberships depuis{" "}
          <Link href="/admin/events">/admin/events</Link>.
        </p>
      ) : (
        <div className="bracket-badges">
          {events.map((ev) => (
            <Link
              key={ev.slug}
              href={`/admin/events/${ev.slug}/edit`}
              className="bracket-badge"
            >
              <span className="bracket-badge-name">{ev.name}</span>
              <span className="bracket-badge-score">{ev.score} pts</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── Add solve ─────────────────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: "2.5rem" }}>
        Valider un challenge
      </p>
      <p
        style={{
          color: "var(--muted)",
          fontFamily: "var(--mono)",
          fontSize: 12,
          marginBottom: "1rem",
        }}
      >
        // crédite le score global ; les événements liés crédités seulement si
        le challenge en fait partie et la date de validation tombe dans la durée
      </p>
      <SearchableSelect
        options={candidates.map((c) => ({
          value: c.slug,
          label: `${c.category?.name ?? ""} · ${c.title} (+${c.score})`,
          search: [c.title, c.category?.name],
        }))}
        value={pickedChallenge}
        onChange={setPickedChallenge}
        placeholder="rechercher un challenge..."
        emptyText="Aucun challenge à valider"
      />
      <div className="solve-add-commit">
        <input
          type="datetime-local"
          value={pickedSolvedAt}
          onChange={(e) => setPickedSolvedAt(e.target.value)}
          title="Date de validation (laisser vide = maintenant)"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={addSolve}
          disabled={!pickedChallenge || pendingAction !== null}
        >
          {pendingAction === `add:${pickedChallenge}` ? "..." : "+ Valider"}
        </button>
      </div>
      <p
        style={{
          color: "var(--muted)",
          fontFamily: "var(--mono)",
          fontSize: 11,
          marginTop: "0.4rem",
        }}
      >
        // date optionnelle — vide = maintenant. Une date dans la durée d&apos;un
        événement crédite aussi le score de l&apos;événement
      </p>

      {/* ── Solves table ──────────────────────────────────────────── */}
      <p className="section-title" style={{ marginTop: "2.5rem" }}>
        Challenges validés ({solves.length})
      </p>

      {error && <div className="login-error">{error}</div>}

      {solves.length === 0 ? (
        <div className="empty-card">
          <p className="empty-tag">// no_data</p>
          <p>Aucun challenge validé.</p>
        </div>
      ) : (
        <div className="solves-table">
          <div className="solve-row solve-row-head">
            <div>challenge</div>
            <div>catégorie</div>
            <div>difficulté</div>
            <div className="solve-num">pts</div>
            <div>quand</div>
            <div className="solve-actions"></div>
          </div>
          {[...solves]
            .sort(
              (a, b) =>
                Date.parse(b.solvedAt) - Date.parse(a.solvedAt),
            )
            .map((s) => (
              <div key={s.challenge.slug} className="solve-row">
                <Link
                  href={`/challenges/${s.challenge.category.slug}/${s.challenge.slug}`}
                  className="solve-title"
                >
                  {s.challenge.title}
                </Link>
                <div className="solve-dim">{s.challenge.category.name}</div>
                <div>
                  <span className={`diff-badge diff-${s.difficulty}`}>
                    {DIFFICULTY_LABELS[s.difficulty]}
                  </span>
                </div>
                <div className="solve-num">+{s.score}</div>
                <div className="solve-dim">{formatDateTime(s.solvedAt)}</div>
                <div className="solve-actions">
                  <button
                    type="button"
                    className="form-slot-remove"
                    onClick={() => removeSolve(s.challenge.slug)}
                    disabled={pendingAction === `del:${s.challenge.slug}`}
                    title="Retirer la validation"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── Danger zone ─────────────────────────────────────────── */}
      <div className="danger-zone">
        <p className="danger-zone-title">// danger_zone</p>
        <p className="danger-zone-text">
          Supprime ce compte définitivement : sessions, validations de
          challenges et participations à des événements sont retirées avec
          lui. Les scores globaux des autres utilisateurs ne sont pas
          modifiés.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
          disabled={deleting || isSelf}
          title={
            isSelf
              ? "Tu ne peux pas supprimer ton propre compte"
              : undefined
          }
        >
          {deleting ? "Suppression..." : "Supprimer cet utilisateur"}
        </button>
      </div>
    </>
  );
}
