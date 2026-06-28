import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { unlink } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../core/prisma/prisma.service";
import { slugify } from "../core/slug";
import { UPLOADS_DIR } from "../core/uploads";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  list() {
    return this.prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { members: true, challenges: true } },
      },
    });
  }

  async getBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        _count: { select: { members: true, challenges: true } },
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  async getDetail(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        _count: { select: { members: true, challenges: true } },
        members: {
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
        },
        challenges: {
          include: {
            challenge: {
              select: {
                id: true,
                slug: true,
                title: true,
                score: true,
                difficulty: true,
                category: { select: { slug: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  // ─── Writes ───────────────────────────────────────────────────────────────

  async create(input: {
    name: string;
    description: string;
    startsAt: Date;
    endsAt: Date;
    imageFilename: string | null;
  }) {
    if (input.endsAt <= input.startsAt) {
      throw new BadRequestException("La date de fin doit suivre la date de début");
    }

    const slug = slugify(input.name);
    if (!slug) throw new BadRequestException("Invalid name");

    const existing = await this.prisma.event.findFirst({
      where: { OR: [{ slug }, { name: input.name }] },
    });
    if (existing) throw new ConflictException("Event already exists");

    return this.prisma.event.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        imageUrl: input.imageFilename ? `/uploads/${input.imageFilename}` : null,
      },
      include: { _count: { select: { members: true, challenges: true } } },
    });
  }

  async update(
    slug: string,
    input: {
      name?: string;
      description?: string;
      startsAt?: Date;
      endsAt?: Date;
      imageFilename?: string;
    },
  ) {
    const event = await this.getBySlug(slug);

    if (input.name && input.name !== event.name) {
      const clash = await this.prisma.event.findUnique({
        where: { name: input.name },
      });
      if (clash) throw new ConflictException("Name already used");
    }

    const startsAt = input.startsAt ?? event.startsAt;
    const endsAt = input.endsAt ?? event.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException("La date de fin doit suivre la date de début");
    }

    let newImageUrl: string | undefined = undefined;
    if (input.imageFilename) {
      newImageUrl = `/uploads/${input.imageFilename}`;
      if (event.imageUrl) {
        const oldName = event.imageUrl.replace(/^\/uploads\//, "");
        await unlink(join(UPLOADS_DIR, oldName)).catch(() => {});
      }
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        startsAt: input.startsAt ?? undefined,
        endsAt: input.endsAt ?? undefined,
        imageUrl: newImageUrl,
      },
      include: { _count: { select: { members: true, challenges: true } } },
    });
  }

  async delete(slug: string) {
    const event = await this.getBySlug(slug);
    if (event.imageUrl) {
      const oldName = event.imageUrl.replace(/^\/uploads\//, "");
      await unlink(join(UPLOADS_DIR, oldName)).catch(() => {});
    }
    await this.prisma.event.delete({ where: { id: event.id } });
  }

  // ─── Members ──────────────────────────────────────────────────────────────

  async addMember(slug: string, login: string) {
    const event = await this.getBySlug(slug);
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");

    const existing = await this.prisma.eventMember.findUnique({
      where: { userId_eventId: { userId: user.id, eventId: event.id } },
    });
    if (existing) throw new ConflictException("User already in event");

    return this.prisma.eventMember.create({
      data: { userId: user.id, eventId: event.id },
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
  }

  async removeMember(slug: string, userId: number) {
    const event = await this.getBySlug(slug);
    await this.prisma.eventMember.delete({
      where: { userId_eventId: { userId, eventId: event.id } },
    });
  }

  // ─── Challenges ───────────────────────────────────────────────────────────

  async addChallenge(slug: string, challengeSlug: string) {
    const event = await this.getBySlug(slug);
    const challenge = await this.prisma.challenge.findUnique({
      where: { slug: challengeSlug },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");

    const existing = await this.prisma.eventChallenge.findUnique({
      where: {
        eventId_challengeId: {
          eventId: event.id,
          challengeId: challenge.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException("Ce challenge fait déjà partie de l'événement");
    }

    return this.prisma.eventChallenge.create({
      data: { eventId: event.id, challengeId: challenge.id },
    });
  }

  async removeChallenge(slug: string, challengeSlug: string) {
    const event = await this.getBySlug(slug);
    const challenge = await this.prisma.challenge.findUnique({
      where: { slug: challengeSlug },
    });
    if (!challenge) throw new NotFoundException("Challenge not found");
    await this.prisma.eventChallenge.delete({
      where: {
        eventId_challengeId: {
          eventId: event.id,
          challengeId: challenge.id,
        },
      },
    });
  }
}
