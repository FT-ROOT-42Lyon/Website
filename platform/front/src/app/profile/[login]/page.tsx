"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";
import type { Me } from "~/lib/auth-context";

export default function UserProfilePage() {
  const { login } = useParams<{ login: string }>();
  const { me, loading: authLoading } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    api<Me>(`/users/${encodeURIComponent(login)}`)
      .then(setUser)
      .catch(() => setError("Utilisateur introuvable"));
  }, [login, me, authLoading, router]);

  if (error) {
    return (
      <div className="callback">
        <p className="callback-mono" style={{ color: "var(--red)" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Chargement</p>
      </div>
    );
  }

  const intraUrl = `https://profile.intra.42.fr/users/${user.login}`;
  const isSelf = me?.id === user.id;

  return (
    <>
      <section className="hero">
        {user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="profile-avatar"
          />
        )}
        <h1>
          {user.login}
          <span>@ft_root</span>
        </h1>
        <p className="hero-sub">
          {isSelf ? "// votre profil" : "// profil utilisateur"}
        </p>
        {user.displayName && (
          <p className="hero-desc">{user.displayName}</p>
        )}
      </section>

      <div className="section">
        <p className="section-title">Identité</p>
        <div className="kv-card">
          <div>
            login: <span>{user.login}</span>
          </div>
          {isSelf && (
            <div>
              email: <span>{user.email}</span>
            </div>
          )}
          <div>
            display_name: <span>{user.displayName ?? "—"}</span>
          </div>
          <div>
            staff:{" "}
            <span style={{ color: user.isStaff ? "var(--red)" : undefined }}>
              {String(user.isStaff)}
            </span>
          </div>
          <div>
            score global: <span style={{ color: "var(--red)" }}>{user.score}</span>
          </div>
          <div>
            membre depuis:{" "}
            <span>{new Date(user.createdAt).toLocaleDateString("fr-FR")}</span>
          </div>
        </div>

        <p className="section-title" style={{ marginTop: "3rem" }}>
          Intra 42
        </p>
        <a
          href={intraUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          Voir le profil sur intra.42.fr →
        </a>
      </div>

      <footer>
        <span>ft_root</span> — Club Cybersécurité 42Lyon
      </footer>
    </>
  );
}
