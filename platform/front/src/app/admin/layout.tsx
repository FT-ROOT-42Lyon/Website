"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "~/lib/auth-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace("/login");
    else if (!me.isStaff) router.replace("/");
  }, [me, loading, router]);

  if (loading || !me || !me.isStaff) {
    return (
      <div className="callback">
        <p className="callback-mono callback-blink">Vérification des droits</p>
      </div>
    );
  }

  return (
    <div className="admin-wrap">
      <aside className="admin-side">
        <p className="admin-side-tag">// admin_panel</p>
        <Link href="/admin">Dashboard</Link>
        <Link href="/admin/users">Utilisateurs</Link>
        <Link href="/admin/categories">Catégories</Link>
        <Link href="/admin/challenges">Challenges</Link>
        <Link href="/admin/brackets">Brackets</Link>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
