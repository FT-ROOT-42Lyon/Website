// ─── Shared paths ─────────────────────────────────────────────────────────────
export const ftIntraAuthCallbackPath = "/auth/callback";

// ─── Auth types ──────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: number;
  iat?: number;
  exp?: number;
}

export interface MeResponse {
  id: number;
  login: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  isStaff: boolean;
  score: number;
  // Optional Root-Me linkage.
  rootmeId: number | null;
  rootmeUsername: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface AuthUrlResponse {
  url: string;
}

// ─── Challenge catalog ───────────────────────────────────────────────────────
export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  exploitDescription: string;
  challengeCount: number;
  // Non-null when the category mirrors a Root-Me rubrique.
  rootmeId: number | null;
  createdAt: string;
}

export type Difficulty =
  | "VERY_EASY"
  | "EASY"
  | "MEDIUM"
  | "HARD"
  | "VERY_HARD";

export const DIFFICULTIES: readonly Difficulty[] = [
  "VERY_EASY",
  "EASY",
  "MEDIUM",
  "HARD",
  "VERY_HARD",
] as const;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  VERY_EASY: "très facile",
  EASY: "facile",
  MEDIUM: "moyen",
  HARD: "difficile",
  VERY_HARD: "très difficile",
};

export interface ChallengeResource {
  id: number;
  type: "FILE" | "LINK";
  label: string;
  href: string;
  position: number;
}

export interface ChallengeSummary {
  id: number;
  slug: string;
  title: string;
  description: string;
  score: number;
  difficulty: Difficulty;
  createdAt: string;
  solved: boolean;
  hasFlag: boolean;
  // Non-null when mirroring a Root-Me id_challenge.
  rootmeId: number | null;
  // External URL when the challenge is solved on another platform (Root-Me).
  externalUrl: string | null;
  category?: { slug: string; name: string };
  resourceCount?: number;
}

export interface Challenge extends ChallengeSummary {
  resources: ChallengeResource[];
  category: { slug: string; name: string };
}

export interface SubmitFlagResponse {
  correct: boolean;
  alreadySolved: boolean;
  scoreAwarded: number;
}

// ─── Events (= brackets with a duration) ─────────────────────────────────────
export interface Event {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  memberCount: number;
  challengeCount: number;
}

export interface EventMember {
  id: number;
  score: number;
  joinedAt: string;
  user: {
    id: number;
    login: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface EventChallengeLink {
  id: number;
  challenge: {
    id: number;
    slug: string;
    title: string;
    score: number;
    difficulty: Difficulty;
    category: { slug: string; name: string };
  };
}

export interface EventDetail extends Event {
  members: EventMember[];
  challenges: EventChallengeLink[];
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank: number;
  score: number;
  user: {
    id: number;
    login: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface TimelinePoint {
  solvedAt: string;
  cumulativeScore: number;
  score: number;
  challenge: {
    slug: string;
    title: string;
    category: { slug: string; name: string };
  };
}

export interface TimelineSeries {
  user: {
    id: number;
    login: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  points: TimelinePoint[];
}

// ─── Profile stats ───────────────────────────────────────────────────────────
export interface UserStats {
  user: {
    id: number;
    login: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
    isStaff: boolean;
    score: number;
    createdAt: string;
  };
  globalRank: number;
  totalUsers: number;
  events: Array<{
    slug: string;
    name: string;
    score: number;
    joinedAt: string;
    startsAt: string;
    endsAt: string;
  }>;
  solves: TimelinePoint[];
  difficultyDistribution: Record<Difficulty, number>;
  categoryStats: Array<{
    category: { slug: string; name: string };
    totalChallenges: number;
    solvedCount: number;
    percentage: number;
  }>;
  neighborhood: LeaderboardEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export type EventStatus = "upcoming" | "active" | "past";

export function eventStatus(
  e: { startsAt: string; endsAt: string },
  now: number = Date.now(),
): EventStatus {
  const start = Date.parse(e.startsAt);
  const end = Date.parse(e.endsAt);
  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "active";
}
