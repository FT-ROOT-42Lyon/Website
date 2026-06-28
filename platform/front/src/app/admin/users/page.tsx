"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import type { Me } from "~/lib/auth-context";

export default function AdminUsersPage() {
  const { me } = useAuth();
  const [users, setUsers] = useState<Me[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLogin, setPendingLogin] = useState<string | null>(null);

  // Pre-create form state
  const [newLogin, setNewLogin] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  async function reload() {
    const data = await api<Me[]>("/users");
    setUsers(data);
  }

  useEffect(() => {
    reload().catch(() => setError("Impossible de charger les utilisateurs"));
  }, []);

  async function createFromIntra(e: React.FormEvent) {
    e.preventDefault();
    if (!newLogin.trim()) return;
    setError(null);
    setCreateMsg(null);
    setCreating(true);
    try {
      const created = await api<Me>("/users", {
        method: "POST",
        body: JSON.stringify({ login: newLogin.trim() }),
      });
      setCreateMsg(`✓ ${created.login} ajouté`);
      setNewLogin("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  }

  async function setRole(login: string, isStaff: boolean) {
    setError(null);
    setPendingLogin(login);
    try {
      const updated = await api<Me>(`/users/${login}/role`, {
        method: "PATCH",
        body: JSON.stringify({ isStaff }),
      });
      setUsers((cur) =>
        cur ? cur.map((u) => (u.login === login ? updated : u)) : cur,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de mise à jour du rôle",
      );
    } finally {
      setPendingLogin(null);
    }
  }

  return (
    <>
      <p className="section-title">Utilisateurs</p>

      {/* ── Pre-create from 42 intra ─────────────────────────────── */}
      <form className="form intra-add-form" onSubmit={createFromIntra}>
        <div className="form-field">
          <span>Ajouter un utilisateur via l&apos;intra 42</span>
          <div className="intra-add-row">
            <input
              type="text"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              placeholder="login (ex: ethebaul)"
              autoComplete="off"
              spellCheck={false}
              disabled={creating}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating || !newLogin.trim()}
            >
              {creating ? "Récupération..." : "+ Ajouter"}
            </button>
          </div>
          <small>
            Le profil est récupéré depuis l&apos;intra. Quand l&apos;utilisateur
            se connectera plus tard via OAuth, son compte sera reconnu et son
            avatar/email rafraîchis.
          </small>
        </div>
        {createMsg && (
          <p style={{ color: "var(--solved)", fontFamily: "var(--mono)", fontSize: 13 }}>
            {createMsg}
          </p>
        )}
      </form>

      {error && (
        <p style={{ color: "var(--red)", fontFamily: "var(--mono)" }}>
          {error}
        </p>
      )}

      {!users ? (
        <p className="callback-mono callback-blink">Chargement</p>
      ) : (
        <div className="user-table">
          <div className="user-row user-row-head">
            <div>login</div>
            <div>display_name</div>
            <div>email</div>
            <div className="user-role-col">rôle</div>
          </div>
          {users.map((u) => {
            const isSelf = me?.id === u.id;
            return (
              <div key={u.id} className="user-row">
                <Link href={`/admin/users/${u.login}`} className="user-login">
                  {u.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatarUrl} alt="" />
                  )}
                  <span>{u.login}</span>
                </Link>
                <div>{u.displayName ?? "—"}</div>
                <div className="user-email">{u.email}</div>
                <div className="user-role-col">
                  <select
                    className={`role-select ${u.isStaff ? "role-staff" : ""}`}
                    value={u.isStaff ? "staff" : "member"}
                    disabled={isSelf || pendingLogin === u.login}
                    title={
                      isSelf
                        ? "Tu ne peux pas changer ton propre rôle"
                        : undefined
                    }
                    onChange={(e) =>
                      setRole(u.login, e.target.value === "staff")
                    }
                  >
                    <option value="member">member</option>
                    <option value="staff">staff</option>
                  </select>
                </div>
              </div>
            );
          })}
          {users.length === 0 && (
            <p style={{ color: "var(--muted)", padding: "1rem" }}>
              Aucun utilisateur enregistré pour l&apos;instant.
            </p>
          )}
        </div>
      )}
    </>
  );
}
