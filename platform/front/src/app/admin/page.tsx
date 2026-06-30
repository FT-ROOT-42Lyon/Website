import Link from "next/link";
import { RootmeAdminSync } from "~/components/RootmeAdminSync";

export default function AdminHomePage() {
  return (
    <>
      <p className="section-title">Panneau d&apos;administration</p>
      <p style={{ color: "var(--muted)", marginBottom: "2rem" }}>
        Espace réservé au staff du club.
      </p>

      <div className="cards">
        <Link href="/admin/users" className="card card-link-block">
          <p className="card-tag">// gestion</p>
          <h3>Utilisateurs</h3>
          <p>Liste de tous les comptes enregistrés via l&apos;intra 42.</p>
          <span className="card-link">Ouvrir →</span>
        </Link>
        <Link href="/admin/categories" className="card card-link-block">
          <p className="card-tag">// catalogue</p>
          <h3>Catégories</h3>
          <p>Ajouter ou consulter les catégories de challenges.</p>
          <span className="card-link">Ouvrir →</span>
        </Link>
        <Link href="/admin/challenges" className="card card-link-block">
          <p className="card-tag">// catalogue</p>
          <h3>Challenges</h3>
          <p>Liste de tous les challenges et création de nouveaux sujets.</p>
          <span className="card-link">Ouvrir →</span>
        </Link>
        <Link href="/admin/events" className="card card-link-block">
          <p className="card-tag">// événements</p>
          <h3>Événements</h3>
          <p>
            Créer et gérer les événements : membres, challenges associés, dates.
          </p>
          <span className="card-link">Ouvrir →</span>
        </Link>
      </div>

      <div style={{ marginTop: "2.5rem", maxWidth: 720 }}>
        <RootmeAdminSync />
      </div>
    </>
  );
}
