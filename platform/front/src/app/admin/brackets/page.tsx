"use client";

import Link from "next/link";
import { useBrackets } from "~/lib/brackets-context";

export default function AdminBracketsPage() {
  const { brackets, loading } = useBrackets();

  return (
    <>
      <div className="admin-head">
        <p className="section-title" style={{ marginBottom: 0 }}>
          Brackets
        </p>
        <Link href="/admin/brackets/new" className="btn btn-primary">
          + Nouveau bracket
        </Link>
      </div>

      {loading ? (
        <p className="callback-mono callback-blink">Chargement</p>
      ) : brackets.length === 0 ? (
        <div className="empty-card">
          <p className="empty-tag">// no_data</p>
          <p>Aucun bracket pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="cat-table">
          <div className="cat-row cat-row-head">
            <div>slug</div>
            <div>nom</div>
            <div>description</div>
            <div className="cat-count-col">membres</div>
          </div>
          {brackets.map((b) => (
            <Link
              key={b.id}
              href={`/admin/brackets/${b.slug}`}
              className="cat-row cat-row-link"
            >
              <div className="cat-slug">{b.slug}</div>
              <div>{b.name}</div>
              <div className="cat-dim">
                {b.description.length > 80
                  ? b.description.slice(0, 80) + "..."
                  : b.description}
              </div>
              <div className="cat-count-col">{b.memberCount}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
