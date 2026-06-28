"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { BracketDetail, MeResponse } from "@ft-root/shared";
import { api } from "~/lib/api";
import { useBrackets } from "~/lib/brackets-context";

export default function ManageBracketPage() {
  const { slug } = useParams<{ slug: string }>();
  const { refresh: refreshBrackets } = useBrackets();

  const [bracket, setBracket] = useState<BracketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const [allUsers, setAllUsers] = useState<MeResponse[]>([]);
  const [pickedLogin, setPickedLogin] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  async function load() {
    const b = await api<BracketDetail>(`/brackets/${slug}`);
    setBracket(b);
    setName(b.name);
    setDescription(b.description);
  }

  useEffect(() => {
    Promise.all([
      load(),
      api<MeResponse[]>("/users").then(setAllUsers),
    ]).catch(() => setError("Impossible de charger le bracket"));
  }, [slug]);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavingMeta(true);
    try {
      await api(`/brackets/${slug}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description }),
      });
      await Promise.all([load(), refreshBrackets()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSavingMeta(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!pickedLogin) return;
    setError(null);
    setAddingMember(true);
    try {
      // Score starts at 0 — it's credited automatically when the user solves
      // challenges while a member of this bracket.
      await api(`/brackets/${slug}/members`, {
        method: "POST",
        body: JSON.stringify({ login: pickedLogin, score: 0 }),
      });
      setPickedLogin("");
      await Promise.all([load(), refreshBrackets()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'ajout");
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(userId: number) {
    try {
      await api(`/brackets/${slug}/members/${userId}`, { method: "DELETE" });
      await Promise.all([load(), refreshBrackets()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de suppression");
    }
  }

  if (error && !bracket) {
    return (
      <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>{error}</p>
    );
  }

  if (!bracket) {
    return <p className="callback-mono callback-blink">Chargement</p>;
  }

  const memberIds = new Set(bracket.members.map((m) => m.user.id));
  const candidates = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Bracket
        </p>
        <Link
          href={`/leaderboard/brackets/${bracket.slug}`}
          className="btn"
          target="_blank"
        >
          Voir le leaderboard ↗
        </Link>
      </div>

      <form className="form" onSubmit={saveMeta} style={{ marginBottom: "3rem" }}>
        <label className="form-field">
          <span>Nom</span>
          <input
            type="text"
            value={name}
            required
            minLength={2}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            required
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
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

      <p className="section-title">Membres ({bracket.members.length})</p>
      <p style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 12, marginBottom: "1rem" }}>
        // les scores sont automatiquement crédités quand un membre valide un
        challenge avec le bon flag
      </p>

      <form
        className="form bracket-add-form"
        onSubmit={addMember}
        style={{ marginBottom: "2rem" }}
      >
        <div className="form-field">
          <span>Ajouter un utilisateur au bracket</span>
          <div className="bracket-add-row bracket-add-row-simple">
            <select
              value={pickedLogin}
              onChange={(e) => setPickedLogin(e.target.value)}
              required
            >
              <option value="">— sélectionner un utilisateur —</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.login}>
                  {u.login}
                  {u.displayName ? ` (${u.displayName})` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={addingMember || !pickedLogin}
            >
              + Ajouter
            </button>
          </div>
        </div>
      </form>

      {error && <div className="login-error">{error}</div>}

      {bracket.members.length === 0 ? (
        <div className="empty-card">
          <p className="empty-tag">// no_members</p>
          <p>Aucun membre dans ce bracket pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="member-table">
          <div className="member-row member-row-head">
            <div>utilisateur</div>
            <div className="member-score-col">score</div>
            <div className="member-actions-col"></div>
          </div>
          {bracket.members.map((m) => (
            <div key={m.id} className="member-row">
              <Link href={`/profile/${m.user.login}`} className="member-login">
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
                  onClick={() => {
                    if (confirm(`Retirer ${m.user.login} du bracket ?`))
                      removeMember(m.user.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
