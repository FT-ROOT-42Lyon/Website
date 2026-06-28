"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/42/url`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setLoading(false);
      setError("Impossible de joindre l'API. Vérifie que le backend tourne.");
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="login-tag">// auth required</p>
        <h2>Connexion</h2>
        <p>
          L&apos;accès à la plateforme se fait uniquement via l&apos;intra 42.
          Aucune autre méthode d&apos;authentification n&apos;est disponible.
        </p>

        <button
          className="btn btn-primary"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Redirection..." : "Continuer avec 42 →"}
        </button>

        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
