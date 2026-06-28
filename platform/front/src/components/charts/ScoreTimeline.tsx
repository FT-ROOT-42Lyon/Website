"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TimelineSeries } from "@ft-root/shared";

// 10-color rotation. Top-3 first to give podium users distinctive colors.
const PALETTE = [
  "#facc15", // gold
  "#cbd5e1", // silver
  "#fb923c", // bronze
  "#e0001b", // red
  "#3b82f6", // blue
  "#4ade80", // green
  "#a78bfa", // purple
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#f59e0b", // orange
];

const WIDTH = 800;
const HEIGHT = 300;
const PAD_LEFT = 50;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 50;

interface Props {
  series: TimelineSeries[];
  // Show user names in a legend (only useful for multi-series leaderboards).
  showLegend?: boolean;
}

interface Hover {
  seriesIdx: number;
  pointIdx: number;
  px: number;
  py: number;
}

export function ScoreTimeline({ series, showLegend = false }: Props) {
  const router = useRouter();
  const [hovered, setHovered] = useState<Hover | null>(null);

  // ── Extents ─────────────────────────────────────────────────────────────
  let minT = Infinity;
  let maxT = -Infinity;
  let maxS = 0;
  for (const s of series) {
    for (const p of s.points) {
      const t = Date.parse(p.solvedAt);
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
      if (p.cumulativeScore > maxS) maxS = p.cumulativeScore;
    }
  }

  if (!Number.isFinite(minT) || series.length === 0) {
    return (
      <div className="empty-card">
        <p className="empty-tag">// no_data</p>
        <p>Aucun challenge validé pour le moment.</p>
      </div>
    );
  }

  if (maxT === minT) maxT = minT + 1;
  if (maxS === 0) maxS = 100;

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (t: number) =>
    PAD_LEFT + ((t - minT) / (maxT - minT)) * innerW;
  const y = (v: number) => PAD_TOP + innerH - (v / maxS) * innerH;

  const pixelSeries = series.map((s, i) => ({
    ...s,
    color: PALETTE[i % PALETTE.length],
    pixels: s.points.map((p) => ({
      original: p,
      px: x(Date.parse(p.solvedAt)),
      py: y(p.cumulativeScore),
    })),
  }));

  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const dateFmt = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
  });

  const hoveredPoint =
    hovered &&
    pixelSeries[hovered.seriesIdx]?.pixels[hovered.pointIdx]?.original;
  const hoveredSeriesLabel =
    hovered && pixelSeries[hovered.seriesIdx]?.user.login;

  return (
    <div className="chart-container">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="chart-svg"
      >
        {/* Y grid lines */}
        {tickFractions.map((f) => (
          <line
            key={f}
            x1={PAD_LEFT}
            x2={WIDTH - PAD_RIGHT}
            y1={PAD_TOP + innerH * (1 - f)}
            y2={PAD_TOP + innerH * (1 - f)}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />
        ))}
        {/* Y axis labels */}
        {tickFractions.map((f) => (
          <text
            key={f}
            x={PAD_LEFT - 8}
            y={PAD_TOP + innerH * (1 - f) + 4}
            textAnchor="end"
            className="chart-axis-label"
          >
            {Math.round(maxS * f)}
          </text>
        ))}
        {/* X axis labels: start and end dates */}
        <text
          x={PAD_LEFT}
          y={HEIGHT - 16}
          textAnchor="start"
          className="chart-axis-label"
        >
          {dateFmt.format(new Date(minT))}
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 16}
          textAnchor="end"
          className="chart-axis-label"
        >
          {dateFmt.format(new Date(maxT))}
        </text>

        {pixelSeries.map((s, sIdx) => {
          const path = s.pixels
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.px} ${p.py}`)
            .join(" ");
          return (
            <g key={sIdx}>
              <path
                d={path}
                stroke={s.color}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.pixels.map((p, pIdx) => (
                <circle
                  key={pIdx}
                  cx={p.px}
                  cy={p.py}
                  r={hovered?.seriesIdx === sIdx && hovered?.pointIdx === pIdx ? 6 : 4}
                  fill={s.color}
                  stroke="var(--bg)"
                  strokeWidth={1.5}
                  className="chart-point"
                  onMouseEnter={() =>
                    setHovered({
                      seriesIdx: sIdx,
                      pointIdx: pIdx,
                      px: p.px,
                      py: p.py,
                    })
                  }
                  onMouseLeave={() => setHovered(null)}
                  onClick={() =>
                    router.push(
                      `/challenges/${p.original.challenge.category.slug}/${p.original.challenge.slug}`,
                    )
                  }
                />
              ))}
            </g>
          );
        })}
      </svg>

      {hovered && hoveredPoint && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(hovered.px / WIDTH) * 100}%`,
            top: `${(hovered.py / HEIGHT) * 100}%`,
          }}
        >
          {showLegend && hoveredSeriesLabel && (
            <div className="chart-tooltip-user">{hoveredSeriesLabel}</div>
          )}
          <div className="chart-tooltip-title">
            {hoveredPoint.challenge.title}
          </div>
          <div className="chart-tooltip-meta">
            {hoveredPoint.challenge.category.name} · +{hoveredPoint.score} pts
          </div>
          <div className="chart-tooltip-total">
            total : {hoveredPoint.cumulativeScore} pts
          </div>
        </div>
      )}

      {showLegend && (
        <ul className="chart-legend">
          {pixelSeries.map((s, i) => (
            <li key={i}>
              <span
                className="chart-legend-swatch"
                style={{ background: s.color }}
              />
              {s.user.login}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
