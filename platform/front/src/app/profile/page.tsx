"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";

// /profile redirects to /profile/[my-login]. Convenient target for the nav link
// before we know the user's login at render time.
export default function ProfileRedirect() {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/login");
    else router.replace(`/profile/${me.login}`);
  }, [me, loading, router]);

  return (
    <div className="callback">
      <p className="callback-mono callback-blink">Chargement du profil</p>
    </div>
  );
}
