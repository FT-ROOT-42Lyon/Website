"use client";

import { DIFFICULTY_LABELS, type Difficulty } from "@ft-root/shared";

const COLORS: Record<Difficulty, string> = {
  VERY_EASY: "#4ade80",
  EASY: "#86efac",
  MEDIUM: "#facc15",
  HARD: "#fb923c",
  VERY_HARD: "#e0001b",
};

const ORDER: Difficulty[] = [
  "VERY_EASY",
  "EASY",
  "MEDIUM",
  "HARD",
  "VERY_HARD",
];

interface Props {
  distribution: Record<Difficulty, number>;
}

export function DifficultyDonut({ distribution }: Props) {
  const total = ORDER.reduce((sum, d) => sum + distribution[d], 0);

  if (total === 0) {
    return (
      <div className="empty-card">
        <p className="empty-tag">// no_data</p>
        <p>Aucun challenge validé.</p>
      </div>
    );
  }

  const cx = 100;
  const cy = 100;
  const outer = 80;
  const inner = 50;

  let cursor = -Math.PI / 2;
  const polar = (a: number, r: number) => ({
    x: cx + Math.cos(a) * r,
    y: cy + Math.sin(a) * r,
  });

  // A single-slice donut would render as a degenerate arc (start === end), so
  // draw two semi-circles instead.
  const allInOne = ORDER.filter((d) => distribution[d] > 0).length === 1;

  const slices = ORDER.filter((d) => distribution[d] > 0).map((d) => {
    const fraction = distribution[d] / total;
    const span = allInOne ? Math.PI * 2 - 0.001 : fraction * Math.PI * 2;
    const start = cursor;
    const end = cursor + span;
    cursor = end;

    const outerStart = polar(start, outer);
    const outerEnd = polar(end, outer);
    const innerEnd = polar(end, inner);
    const innerStart = polar(start, inner);
    const largeArc = span > Math.PI ? 1 : 0;

    return {
      difficulty: d,
      color: COLORS[d],
      path: [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outer} ${outer} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
        "Z",
      ].join(" "),
    };
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" className="donut-svg">
        {slices.map((s) => (
          <path key={s.difficulty} d={s.path} fill={s.color} />
        ))}
        <text x="100" y="92" textAnchor="middle" className="donut-center-label">
          total
        </text>
        <text x="100" y="115" textAnchor="middle" className="donut-center-value">
          {total}
        </text>
      </svg>
      <ul className="donut-legend">
        {ORDER.map((d) => (
          <li key={d} className={distribution[d] === 0 ? "donut-legend-zero" : ""}>
            <span
              className="donut-swatch"
              style={{ background: COLORS[d] }}
            />
            {DIFFICULTY_LABELS[d]}
            <span className="donut-count">{distribution[d]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
