import { Controller, Get, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";

interface RawUser {
  id: number;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function entry(rank: number, score: number, user: RawUser) {
  return { rank, score, user };
}

const DEFAULT_TIMELINE_TOP = 10;

@Controller("leaderboard")
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly prisma: PrismaService) {}

  // Global ranking — all users by their lifetime score (desc).
  @Get()
  async global() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ score: "desc" }, { login: "asc" }],
      select: {
        id: true,
        login: true,
        displayName: true,
        avatarUrl: true,
        score: true,
      },
    });
    return users.map((u, i) =>
      entry(i + 1, u.score, {
        id: u.id,
        login: u.login,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      }),
    );
  }

  // Global timeline — top N users' cumulative score over time. `top` query
  // param is clamped to [1, 50] to keep the chart readable.
  @Get("timeline")
  async globalTimeline(@Query("top") top?: string) {
    const limit = Math.max(1, Math.min(50, Number(top) || DEFAULT_TIMELINE_TOP));
    const topUsers = await this.prisma.user.findMany({
      orderBy: [{ score: "desc" }, { login: "asc" }],
      take: limit,
      select: { id: true, login: true, displayName: true, avatarUrl: true },
    });
    return this.computeTimeline(topUsers);
  }

  // Per-bracket ranking — only members of this bracket, sorted by bracket score.
  @Get("brackets/:slug")
  async byBracket(@Param("slug") slug: string) {
    const bracket = await this.prisma.bracket.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, description: true },
    });
    if (!bracket) throw new NotFoundException("Bracket not found");

    const members = await this.prisma.bracketMember.findMany({
      where: { bracketId: bracket.id },
      orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            login: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      bracket,
      entries: members.map((m, i) => entry(i + 1, m.score, m.user)),
    };
  }

  @Get("brackets/:slug/timeline")
  async bracketTimeline(@Param("slug") slug: string) {
    const bracket = await this.prisma.bracket.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                login: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
    if (!bracket) throw new NotFoundException("Bracket not found");

    return this.computeTimeline(bracket.members.map((m) => m.user));
  }

  // Builds, for each given user, a cumulative-score timeline made of their
  // solves in chronological order. Empty users are omitted (would be a flat
  // zero line).
  private async computeTimeline(users: RawUser[]) {
    if (users.length === 0) return [];
    const userIds = users.map((u) => u.id);

    const solves = await this.prisma.challengeSolve.findMany({
      where: { userId: { in: userIds } },
      orderBy: { solvedAt: "asc" },
      include: {
        challenge: {
          select: {
            slug: true,
            title: true,
            category: { select: { slug: true, name: true } },
          },
        },
      },
    });

    const series = users.map((u) => ({ user: u, points: [] as Array<{
      solvedAt: string;
      cumulativeScore: number;
      score: number;
      challenge: {
        slug: string;
        title: string;
        category: { slug: string; name: string };
      };
    }>}));
    const idx = new Map(series.map((s, i) => [s.user.id, i]));

    for (const s of solves) {
      const seriesIdx = idx.get(s.userId);
      if (seriesIdx === undefined) continue;
      const entry = series[seriesIdx];
      const previous =
        entry.points[entry.points.length - 1]?.cumulativeScore ?? 0;
      entry.points.push({
        solvedAt: s.solvedAt.toISOString(),
        cumulativeScore: previous + s.scoreAwarded,
        score: s.scoreAwarded,
        challenge: {
          slug: s.challenge.slug,
          title: s.challenge.title,
          category: s.challenge.category,
        },
      });
    }

    return series.filter((s) => s.points.length > 0);
  }
}
