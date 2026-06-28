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

  // Per-event ranking — members sorted by per-event score (desc).
  @Get("events/:slug")
  async byEvent(@Param("slug") slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const members = await this.prisma.eventMember.findMany({
      where: { eventId: event.id },
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
      event: {
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
      },
      entries: members.map((m, i) => entry(i + 1, m.score, m.user)),
    };
  }

  // Timeline for an event = solves of the event's challenges by event members
  // within the event window. This reflects how the event leaderboard actually
  // evolved, not every solve those members ever made.
  @Get("events/:slug/timeline")
  async eventTimeline(@Param("slug") slug: string) {
    const event = await this.prisma.event.findUnique({
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
        challenges: { select: { challengeId: true } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");

    const userIds = event.members.map((m) => m.userId);
    const challengeIds = event.challenges.map((c) => c.challengeId);
    if (userIds.length === 0 || challengeIds.length === 0) return [];

    const solves = await this.prisma.challengeSolve.findMany({
      where: {
        userId: { in: userIds },
        challengeId: { in: challengeIds },
        solvedAt: { gte: event.startsAt, lte: event.endsAt },
      },
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

    return this.buildSeries(
      event.members.map((m) => m.user),
      solves,
    );
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async computeTimeline(users: RawUser[]) {
    if (users.length === 0) return [];
    const solves = await this.prisma.challengeSolve.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
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
    return this.buildSeries(users, solves);
  }

  private buildSeries(
    users: RawUser[],
    solves: Array<{
      userId: number;
      solvedAt: Date;
      scoreAwarded: number;
      challenge: {
        slug: string;
        title: string;
        category: { slug: string; name: string };
      };
    }>,
  ) {
    const series = users.map((u) => ({
      user: u,
      points: [] as Array<{
        solvedAt: string;
        cumulativeScore: number;
        score: number;
        challenge: {
          slug: string;
          title: string;
          category: { slug: string; name: string };
        };
      }>,
    }));
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
        challenge: s.challenge,
      });
    }

    return series.filter((s) => s.points.length > 0);
  }
}
