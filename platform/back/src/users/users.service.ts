import { Injectable, NotFoundException } from "@nestjs/common";
import { Difficulty } from "@prisma/client";
import { PrismaService } from "../core/prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async getByLogin(login: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async list() {
    return this.prisma.user.findMany({
      orderBy: [{ isStaff: "desc" }, { login: "asc" }],
    });
  }

  async setStaff(id: number, isStaff: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isStaff },
    });
  }

  // Heavy aggregator used by the redesigned profile page. A handful of queries
  // but they're all bounded by the size of the club — fine for our scale.
  async getStats(login: string) {
    const user = await this.prisma.user.findUnique({
      where: { login },
      include: {
        bracketMembers: {
          orderBy: { joinedAt: "asc" },
          include: { bracket: { select: { slug: true, name: true } } },
        },
        solves: {
          orderBy: { solvedAt: "asc" },
          include: {
            challenge: {
              select: {
                slug: true,
                title: true,
                difficulty: true,
                categoryId: true,
                category: { select: { slug: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException("User not found");

    // ─── Global rank (1-based) ────────────────────────────────────────────
    const ranking = await this.prisma.user.findMany({
      orderBy: [{ score: "desc" }, { login: "asc" }],
      select: {
        id: true,
        score: true,
        login: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    const myIdx = ranking.findIndex((u) => u.id === user.id);
    const globalRank = myIdx + 1;

    // ─── Solves with running total ────────────────────────────────────────
    let cumul = 0;
    const solves = user.solves.map((s) => {
      cumul += s.scoreAwarded;
      return {
        challenge: {
          slug: s.challenge.slug,
          title: s.challenge.title,
          category: s.challenge.category,
        },
        difficulty: s.challenge.difficulty,
        score: s.scoreAwarded,
        solvedAt: s.solvedAt.toISOString(),
        cumulativeScore: cumul,
      };
    });

    // ─── Difficulty distribution ──────────────────────────────────────────
    const distribution: Record<Difficulty, number> = {
      VERY_EASY: 0,
      EASY: 0,
      MEDIUM: 0,
      HARD: 0,
      VERY_HARD: 0,
    };
    for (const s of user.solves) {
      distribution[s.challenge.difficulty] += 1;
    }

    // ─── Category stats ───────────────────────────────────────────────────
    // Only count challenges that actually have a flag (otherwise impossible to
    // solve, so they'd distort the percentage downward).
    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { challenges: { where: { flagHash: { not: null } } } },
        },
      },
      orderBy: { name: "asc" },
    });
    const solvedByCategory = new Map<number, number>();
    for (const s of user.solves) {
      const catId = s.challenge.categoryId;
      solvedByCategory.set(catId, (solvedByCategory.get(catId) ?? 0) + 1);
    }
    const categoryStats = categories.map((c) => {
      const solvedCount = solvedByCategory.get(c.id) ?? 0;
      const total = c._count.challenges;
      return {
        category: { slug: c.slug, name: c.name },
        totalChallenges: total,
        solvedCount,
        percentage: total > 0 ? Math.round((solvedCount / total) * 100) : 0,
      };
    });

    // ─── Neighborhood (2 above + self + 2 below) ──────────────────────────
    const start = Math.max(0, myIdx - 2);
    const end = Math.min(ranking.length, myIdx + 3);
    const neighborhood = ranking.slice(start, end).map((u, i) => ({
      rank: start + i + 1,
      score: u.score,
      user: {
        id: u.id,
        login: u.login,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      },
    }));

    return {
      user: {
        id: user.id,
        login: user.login,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isStaff: user.isStaff,
        score: user.score,
        createdAt: user.createdAt.toISOString(),
      },
      globalRank,
      totalUsers: ranking.length,
      brackets: user.bracketMembers.map((bm) => ({
        slug: bm.bracket.slug,
        name: bm.bracket.name,
        score: bm.score,
        joinedAt: bm.joinedAt.toISOString(),
      })),
      solves,
      difficultyDistribution: distribution,
      categoryStats,
      neighborhood,
    };
  }
}
