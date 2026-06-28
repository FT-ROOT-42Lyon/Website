import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";
import { slugify } from "../core/slug";

@Injectable()
export class BracketsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.bracket.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true } } },
    });
  }

  async getBySlug(slug: string) {
    const bracket = await this.prisma.bracket.findUnique({
      where: { slug },
      include: { _count: { select: { members: true } } },
    });
    if (!bracket) throw new NotFoundException("Bracket not found");
    return bracket;
  }

  async getDetail(slug: string) {
    const bracket = await this.prisma.bracket.findUnique({
      where: { slug },
      include: {
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
        _count: { select: { members: true } },
      },
    });
    if (!bracket) throw new NotFoundException("Bracket not found");
    return bracket;
  }

  async create(input: { name: string; description: string }) {
    const slug = slugify(input.name);
    if (!slug) throw new ConflictException("Invalid name");

    const existing = await this.prisma.bracket.findFirst({
      where: { OR: [{ slug }, { name: input.name }] },
    });
    if (existing) throw new ConflictException("Bracket already exists");

    return this.prisma.bracket.create({
      data: { slug, name: input.name, description: input.description },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(
    slug: string,
    input: { name?: string; description?: string },
  ) {
    const bracket = await this.getBySlug(slug);
    if (input.name && input.name !== bracket.name) {
      const clash = await this.prisma.bracket.findUnique({
        where: { name: input.name },
      });
      if (clash) throw new ConflictException("Name already used");
    }
    return this.prisma.bracket.update({
      where: { id: bracket.id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async addMember(slug: string, login: string, score: number) {
    const bracket = await this.getBySlug(slug);
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");

    const existing = await this.prisma.bracketMember.findUnique({
      where: { userId_bracketId: { userId: user.id, bracketId: bracket.id } },
    });
    if (existing) throw new ConflictException("User already in bracket");

    return this.prisma.bracketMember.create({
      data: { userId: user.id, bracketId: bracket.id, score },
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

  async updateMemberScore(slug: string, userId: number, score: number) {
    const bracket = await this.getBySlug(slug);
    return this.prisma.bracketMember.update({
      where: { userId_bracketId: { userId, bracketId: bracket.id } },
      data: { score },
    });
  }

  async removeMember(slug: string, userId: number) {
    const bracket = await this.getBySlug(slug);
    await this.prisma.bracketMember.delete({
      where: { userId_bracketId: { userId, bracketId: bracket.id } },
    });
  }
}
