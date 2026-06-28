"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "~/lib/api";
import type { Me } from "~/lib/auth-context";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Me[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me[]>("/users")
      .then(setUsers)
      .catch(() => setError("Impossible de charger les utilisateurs"));
  }, []);

  return (
    <>
      <p className="section-title">Utilisateurs</p>

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
            <div className="user-staff-col">staff</div>
          </div>
          {users.map((u) => (
            <Link
              key={u.id}
              href={`/profile/${u.login}`}
              className="user-row user-row-link"
            >
              <div className="user-login">
                {u.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatarUrl} alt="" />
                )}
                <span>{u.login}</span>
              </div>
              <div>{u.displayName ?? "—"}</div>
              <div className="user-email">{u.email}</div>
              <div className="user-staff-col">
                {u.isStaff ? (
                  <span className="badge badge-staff">staff</span>
                ) : (
                  <span className="user-dim">—</span>
                )}
              </div>
            </Link>
          ))}
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
