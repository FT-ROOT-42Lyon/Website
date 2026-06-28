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
  // True if the current user has already submitted a correct flag.
  solved: boolean;
  // True once staff has configured a flag — challenge can be submitted.
  hasFlag: boolean;
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
  // Points credited by this submission (0 if already solved or incorrect).
  scoreAwarded: number;
}

// ─── Brackets ────────────────────────────────────────────────────────────────
export interface Bracket {
  id: number;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
}

export interface BracketMember {
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

export interface BracketDetail extends Bracket {
  members: BracketMember[];
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
