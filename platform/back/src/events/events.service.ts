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

const includeBracket = {
  bracket: { select: { slug: true, name: true } },
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: includeBracket,
    });
  }

  async getBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: includeBracket,
    });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  async create(input: {
    name: string;
    description: string;
    startsAt: Date;
    endsAt: Date;
    imageFilename: string | null;
    bracketSlug: string | null;
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

    const bracketId = await this.resolveBracketId(input.bracketSlug);

    return this.prisma.event.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        imageUrl: input.imageFilename ? `/uploads/${input.imageFilename}` : null,
        bracketId,
      },
      include: includeBracket,
    });
  }

  // `bracketSlug` semantics on update:
  //   undefined → keep existing
  //   ""        → clear (no bracket)
  //   "slug"    → set
  async update(
    slug: string,
    input: {
      name?: string;
      description?: string;
      startsAt?: Date;
      endsAt?: Date;
      imageFilename?: string;
      bracketSlug?: string;
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

    let bracketIdUpdate: number | null | undefined = undefined;
    if (input.bracketSlug !== undefined) {
      bracketIdUpdate = input.bracketSlug
        ? await this.resolveBracketId(input.bracketSlug)
        : null;
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        startsAt: input.startsAt ?? undefined,
        endsAt: input.endsAt ?? undefined,
        imageUrl: newImageUrl,
        bracketId: bracketIdUpdate,
      },
      include: includeBracket,
    });
  }

  private async resolveBracketId(slug: string | null): Promise<number | null> {
    if (!slug) return null;
    const bracket = await this.prisma.bracket.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!bracket) throw new BadRequestException("Bracket inconnu");
    return bracket.id;
  }
}
