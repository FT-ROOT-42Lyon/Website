import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";
import { slugify } from "../core/slug";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { challenges: true } } },
    });
  }

  async getBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  async create(input: {
    name: string;
    description: string;
    exploitDescription: string;
  }) {
    const slug = slugify(input.name);
    if (!slug) throw new ConflictException("Invalid name");

    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ slug }, { name: input.name }] },
    });
    if (existing) throw new ConflictException("Category already exists");

    return this.prisma.category.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        exploitDescription: input.exploitDescription,
      },
    });
  }

  // Slug is not editable — it's the public URL identity.
  async update(
    slug: string,
    input: {
      name?: string;
      description?: string;
      exploitDescription?: string;
    },
  ) {
    const category = await this.getBySlug(slug);

    if (input.name && input.name !== category.name) {
      const clash = await this.prisma.category.findUnique({
        where: { name: input.name },
      });
      if (clash) throw new ConflictException("Name already used");
    }

    return this.prisma.category.update({
      where: { id: category.id },
      data: {
        name: input.name ?? undefined,
        description: input.description ?? undefined,
        exploitDescription: input.exploitDescription ?? undefined,
      },
    });
  }

  // Refuses if the category still has challenges — admin must delete them
  // first. Safer than an opaque cascade that could wipe a lot of work.
  async delete(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { _count: { select: { challenges: true } } },
    });
    if (!category) throw new NotFoundException("Category not found");
    if (category._count.challenges > 0) {
      throw new BadRequestException(
        `Cette catégorie contient ${category._count.challenges} challenge(s). Supprime-les d'abord.`,
      );
    }
    await this.prisma.category.delete({ where: { id: category.id } });
  }
}
