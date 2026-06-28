import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { unlink } from "fs/promises";
import { join } from "path";
import { Difficulty } from "@prisma/client";
import { PrismaService } from "../core/prisma/prisma.service";
import { slugify } from "../core/slug";
import { UPLOADS_DIR } from "../core/uploads";
import { flagMatches, hashFlag } from "../core/flag";
import { findScoringEventIds } from "../core/scoring";

export interface NewFile {
  label: string;
  storedFilename: string;
}

export interface NewLink {
  label: string;
  url: string;
}

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Reads ─────────────────────────────────────────────────────────────────
  // `userId` is required to compute the per-user `solved` flag returned from
  // listing/detail endpoints.

  list(userId: number) {
    return this.prisma.challenge.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true, slug: true } },
        _count: { select: { resources: true } },
        solves: { where: { userId }, select: { id: true } },
      },
    });
  }

  listByCategorySlug(slug: string, userId: number) {
    return this.prisma.challenge.findMany({
      where: { category: { slug } },
      orderBy: [{ difficulty: "asc" }, { title: "asc" }],
      include: {
        _count: { select: { resources: true } },
        solves: { where: { userId }, select: { id: true } },
      },
    });
  }

  async getBySlug(slug: string, userId: number) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { slug },
      include: {
        category: true,
        resources: { orderBy: { position: "asc" } },
        solves: { where: { userId }, select: { id: true } },
      },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");
    return challenge;
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  async create(input: {
    title: string;
    description: string;
    categorySlug: string;
    score: number;
    difficulty: Difficulty;
    flag: string;
    files: NewFile[];
    links: NewLink[];
  }) {
    const category = await this.prisma.category.findUnique({
      where: { slug: input.categorySlug },
    });
    if (!category) throw new BadRequestException("Unknown category");

    const baseSlug = slugify(input.title);
    if (!baseSlug) throw new BadRequestException("Invalid title");

    let slug = baseSlug;
    let attempt = 1;
    while (await this.prisma.challenge.findUnique({ where: { slug } })) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
      if (attempt > 100) throw new ConflictException("Slug collision");
    }

    return this.prisma.challenge.create({
      data: {
        slug,
        title: input.title,
        description: input.description,
        categoryId: category.id,
        score: input.score,
        difficulty: input.difficulty,
        flagHash: hashFlag(input.flag),
        resources: { create: this.buildResources(input.files, input.links) },
      },
      include: { category: true, resources: true },
    });
  }

  async update(
    slug: string,
    input: {
      title?: string;
      description?: string;
      categorySlug?: string;
      score?: number;
      difficulty?: Difficulty;
      // Optional on update — only sets a new hash if provided.
      flag?: string;
      keepResourceIds: number[];
      newFiles: NewFile[];
      newLinks: NewLink[];
    },
  ) {
    const challenge = await this.getBySlug(slug, -1);

    let categoryId = challenge.categoryId;
    if (input.categorySlug && input.categorySlug !== challenge.category.slug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: input.categorySlug },
      });
      if (!category) throw new BadRequestException("Unknown category");
      categoryId = category.id;
    }

    const toDelete = challenge.resources.filter(
      (r) => !input.keepResourceIds.includes(r.id),
    );

    await Promise.all(
      toDelete
        .filter((r) => r.type === "FILE")
        .map((r) =>
          unlink(join(UPLOADS_DIR, r.target)).catch(() => {}),
        ),
    );

    const startPosition =
      challenge.resources
        .filter((r) => input.keepResourceIds.includes(r.id))
        .reduce((max, r) => Math.max(max, r.position), -1) + 1;

    await this.prisma.$transaction([
      this.prisma.challengeResource.deleteMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
      }),
      this.prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          title: input.title ?? undefined,
          description: input.description ?? undefined,
          categoryId,
          score: input.score ?? undefined,
          difficulty: input.difficulty ?? undefined,
          flagHash:
            input.flag !== undefined && input.flag !== ""
              ? hashFlag(input.flag)
              : undefined,
          resources: {
            create: this.buildResources(
              input.newFiles,
              input.newLinks,
              startPosition,
            ),
          },
        },
      }),
    ]);

    return this.getBySlug(slug, -1);
  }

  // ─── Flag submission ───────────────────────────────────────────────────────
  // On a correct submission we credit the user's global score and, if the
  // challenge belongs to an event the user is part of and the submission lands
  // within the event window, that event's per-member score as well. All writes
  // happen in a single transaction so a partial increment can't leave the
  // leaderboards desynced.
  async submitFlag(slug: string, userId: number, flag: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { slug },
      select: { id: true, score: true, flagHash: true },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");
    if (!challenge.flagHash) {
      throw new BadRequestException("Aucun flag n'a été configuré");
    }

    if (!flagMatches(flag, challenge.flagHash)) {
      return { correct: false, alreadySolved: false, scoreAwarded: 0 };
    }

    const existing = await this.prisma.challengeSolve.findUnique({
      where: {
        userId_challengeId: { userId, challengeId: challenge.id },
      },
    });
    if (existing) {
      return { correct: true, alreadySolved: true, scoreAwarded: 0 };
    }

    const solvedAt = new Date();
    const scoringEventIds = await findScoringEventIds(
      this.prisma,
      userId,
      challenge.id,
      solvedAt,
    );

    await this.prisma.$transaction([
      this.prisma.challengeSolve.create({
        data: {
          userId,
          challengeId: challenge.id,
          scoreAwarded: challenge.score,
          solvedAt,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { score: { increment: challenge.score } },
      }),
      ...(scoringEventIds.length > 0
        ? [
            this.prisma.eventMember.updateMany({
              where: { userId, eventId: { in: scoringEventIds } },
              data: { score: { increment: challenge.score } },
            }),
          ]
        : []),
    ]);

    return {
      correct: true,
      alreadySolved: false,
      scoreAwarded: challenge.score,
    };
  }

  // Removes a challenge entirely: file resources are unlinked from disk first,
  // then the row is deleted. ChallengeResource and ChallengeSolve rows cascade
  // away. Existing User.score is left untouched on purpose — rolling back a
  // historical solve is more confusing than helpful.
  async delete(slug: string) {
    const challenge = await this.prisma.challenge.findUnique({
      where: { slug },
      include: { resources: true },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");

    await Promise.all(
      challenge.resources
        .filter((r) => r.type === "FILE")
        .map((r) =>
          unlink(join(UPLOADS_DIR, r.target)).catch(() => {}),
        ),
    );

    await this.prisma.challenge.delete({ where: { id: challenge.id } });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildResources(
    files: NewFile[],
    links: NewLink[],
    startPosition = 0,
  ) {
    return [
      ...files.map((f, i) => ({
        type: "FILE" as const,
        label: f.label,
        target: f.storedFilename,
        position: startPosition + i,
      })),
      ...links.map((l, i) => ({
        type: "LINK" as const,
        label: l.label,
        target: l.url,
        position: startPosition + files.length + i,
      })),
    ];
  }
}
