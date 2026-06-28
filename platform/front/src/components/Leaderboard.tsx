"use client";

import Link from "next/link";
import type { LeaderboardEntry } from "@ft-root/shared";

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="empty-card">
        <p className="empty-tag">// no_data</p>
        <p>Aucune entrée pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="lb-table">
      <div className="lb-row lb-row-head">
        <div className="lb-rank-col">#</div>
        <div>utilisateur</div>
        <div className="lb-score-col">score</div>
      </div>
      {entries.map((e) => (
        <div
          key={e.user.id}
          className={`lb-row lb-row-rank-${e.rank <= 3 ? e.rank : "n"}`}
        >
          <div className="lb-rank-col">{e.rank}</div>
          <Link href={`/profile/${e.user.login}`} className="lb-user">
            {e.user.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.user.avatarUrl} alt="" />
            )}
            <span>{e.user.login}</span>
            {e.user.displayName && <small>{e.user.displayName}</small>}
          </Link>
          <div className="lb-score-col">{e.score}</div>
        </div>
      ))}
    </div>
  );
}
