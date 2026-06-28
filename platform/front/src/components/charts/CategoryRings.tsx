"use client";

import Link from "next/link";

interface CategoryStat {
  category: { slug: string; name: string };
  totalChallenges: number;
  solvedCount: number;
  percentage: number;
}

export function CategoryRings({ stats }: { stats: CategoryStat[] }) {
  if (stats.length === 0) {
    return (
      <div className="empty-card">
        <p className="empty-tag">// no_data</p>
        <p>Aucune catégorie.</p>
      </div>
    );
  }

  return (
    <div className="rings-grid">
      {stats.map((s) => (
        <Link
          key={s.category.slug}
          href={`/challenges/${s.category.slug}`}
          className="ring-card"
        >
          <Ring percentage={s.percentage} />
          <div className="ring-label">{s.category.name}</div>
          <div className="ring-detail">
            {s.solvedCount}/{s.totalChallenges}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Ring({ percentage }: { percentage: number }) {
  const radius = 36;
  const stroke = 6;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - percentage / 100);

  return (
    <svg viewBox="0 0 90 90" className="ring-svg">
      <circle
        cx="45"
        cy="45"
        r={radius}
        stroke="var(--border)"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx="45"
        cy="45"
        r={radius}
        stroke="var(--red)"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 45 45)"
      />
      <text x="45" y="50" textAnchor="middle" className="ring-percent">
        {percentage}%
      </text>
    </svg>
  );
}
