import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Difficulty } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../core/prisma/prisma.service";
import { findScoringEventIds } from "../core/scoring";
import { env } from "../core/env";

const Intra42UserSchema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().email(),
  displayname: z.string().nullable().optional(),
  image: z
    .object({ link: z.string().nullable().optional() })
    .nullable()
    .optional(),
});

const Intra42TokenSchema = z.object({ access_token: z.string() });

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

  // Deletes the User row. Sessions, ChallengeSolves and EventMember rows all
  // cascade via the schema, so no manual cleanup is required. Other users'
  // event scores are not recomputed — a deleted member's points stay where
  // they were credited but their own slot disappears from leaderboards.
  async delete(login: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.delete({ where: { id: user.id } });
  }

  // Pre-seed a user from their 42 login. Uses the client_credentials grant so
  // staff can populate the platform without asking each member to log in first.
  // When the user does log in later, the OAuth callback will match the
  // existing row by `ft42Id` and refresh their email/avatar.
  async createFromIntra(login: string) {
    const cleanLogin = login.trim();
    if (!cleanLogin) throw new BadRequestException("Login requis");

    let tokenJson: unknown;
    let userJson: unknown;
    let userStatus = 0;
    try {
      const tokenRes = await fetch("https://api.intra.42.fr/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: env.API42_CLIENT_UID,
          client_secret: env.API42_CLIENT_SECRET,
        }),
      });
      tokenJson = await tokenRes.json();
      const token = Intra42TokenSchema.parse(tokenJson);

      const userRes = await fetch(
        `https://api.intra.42.fr/v2/users/${encodeURIComponent(cleanLogin)}`,
        {
          headers: { Authorization: `Bearer ${token.access_token}` },
        },
      );
      userStatus = userRes.status;
      userJson = await userRes.json();
    } catch {
      throw new InternalServerErrorException(
        "Impossible de joindre l'API 42",
      );
    }

    if (userStatus === 404) {
      throw new NotFoundException(`Login "${cleanLogin}" inconnu sur l'intra 42`);
    }
    if (userStatus < 200 || userStatus >= 300) {
      throw new InternalServerErrorException(
        "Réponse inattendue de l'API 42",
      );
    }

    const parsed = Intra42UserSchema.safeParse(userJson);
    if (!parsed.success) {
      throw new InternalServerErrorException(
        "Réponse mal formée de l'API 42",
      );
    }
    const data = parsed.data;

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ login: data.login }, { ft42Id: data.id }] },
    });
    if (existing) {
      throw new ConflictException(
        `Cet utilisateur (${existing.login}) est déjà enregistré`,
      );
    }

    return this.prisma.user.create({
      data: {
        ft42Id: data.id,
        login: data.login,
        email: data.email,
        displayName: data.displayname ?? data.login,
        avatarUrl: data.image?.link ?? null,
      },
    });
  }

  // ─── Staff-side solve management ────────────────────────────────────────
  // Same scoring rules as a real flag submission: credit global score and any
  // event the user belongs to where the solve falls in the event window AND
  // the challenge is on the event's challenge list. `solvedAt` defaults to now
  // when staff doesn't override it.
  async addSolve(login: string, challengeSlug: string, solvedAt?: Date) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");

    const challenge = await this.prisma.challenge.findUnique({
      where: { slug: challengeSlug },
      select: { id: true, score: true },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");

    const existing = await this.prisma.challengeSolve.findUnique({
      where: {
        userId_challengeId: { userId: user.id, challengeId: challenge.id },
      },
    });
    if (existing) {
      throw new ConflictException("Ce challenge est déjà validé pour cet utilisateur");
    }

    const at = solvedAt ?? new Date();
    const scoringEventIds = await findScoringEventIds(
      this.prisma,
      user.id,
      challenge.id,
      at,
    );

    await this.prisma.$transaction([
      this.prisma.challengeSolve.create({
        data: {
          userId: user.id,
          challengeId: challenge.id,
          scoreAwarded: challenge.score,
          solvedAt: at,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { score: { increment: challenge.score } },
      }),
      ...(scoringEventIds.length > 0
        ? [
            this.prisma.eventMember.updateMany({
              where: { userId: user.id, eventId: { in: scoringEventIds } },
              data: { score: { increment: challenge.score } },
            }),
          ]
        : []),
    ]);
  }

  // Removing rolls back exactly the points that were awarded at solve time —
  // both globally and on the events that benefited from the original solve.
  async removeSolve(login: string, challengeSlug: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");

    const solve = await this.prisma.challengeSolve.findFirst({
      where: { userId: user.id, challenge: { slug: challengeSlug } },
    });
    if (!solve) throw new NotFoundException("Solve not found");

    const scoringEventIds = await findScoringEventIds(
      this.prisma,
      user.id,
      solve.challengeId,
      solve.solvedAt,
    );

    await this.prisma.$transaction([
      this.prisma.challengeSolve.delete({ where: { id: solve.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { score: { decrement: solve.scoreAwarded } },
      }),
      ...(scoringEventIds.length > 0
        ? [
            this.prisma.eventMember.updateMany({
              where: { userId: user.id, eventId: { in: scoringEventIds } },
              data: { score: { decrement: solve.scoreAwarded } },
            }),
          ]
        : []),
    ]);
  }

  // ─── Stats (used by the profile page) ───────────────────────────────────
  async getStats(login: string) {
    const user = await this.prisma.user.findUnique({
      where: { login },
      include: {
        eventMembers: {
          orderBy: { joinedAt: "asc" },
          include: {
            event: {
              select: {
                slug: true,
                name: true,
                startsAt: true,
                endsAt: true,
              },
            },
          },
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
      events: user.eventMembers.map((em) => ({
        slug: em.event.slug,
        name: em.event.name,
        score: em.score,
        joinedAt: em.joinedAt.toISOString(),
        startsAt: em.event.startsAt.toISOString(),
        endsAt: em.event.endsAt.toISOString(),
      })),
      solves,
      difficultyDistribution: distribution,
      categoryStats,
      neighborhood,
    };
  }
}
