"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccessToken } from "~/lib/api";
import { useAuth } from "~/lib/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function CallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("Authentification en cours");
  const ran = useRef(false);

  useEffect(() => {
    // Strict-mode in dev mounts effects twice; the one-shot OAuth code below
    // would otherwise be consumed by the first run and fail the second.
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const errParam = params.get("error");

    if (errParam) {
      setStatus("error");
      setMessage(
        errParam === "access_denied"
          ? "Connexion refusée"
          : `Erreur OAuth: ${errParam}`,
      );
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Paramètres OAuth manquants");
      return;
    }

    fetch(`${API_URL}/api/auth/42/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{ accessToken: string }>;
      })
      .then(async (json) => {
        setAccessToken(json.accessToken);
        await refresh();
        router.replace("/");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Échec de l'authentification");
      });
  }, [params, router, refresh]);

  return (
    <div className="callback">
      {status === "loading" ? (
        <p className="callback-mono callback-blink">{message}</p>
      ) : (
        <>
          <p className="callback-mono" style={{ color: "var(--red)" }}>
            {message}
          </p>
          <a href="/login" className="btn">
            ← Retour à la connexion
          </a>
        </>
      )}
    </div>
  );
}
