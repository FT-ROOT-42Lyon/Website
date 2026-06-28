import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";
import { slugify } from "../core/slug";

interface DefaultCategory {
  slug: string;
  name: string;
  description: string;
  exploitDescription: string;
}

// Seeded on first boot. Never overwrites existing rows — staff is free to edit
// these afterwards.
const DEFAULTS: DefaultCategory[] = [
  {
    slug: "cracking",
    name: "Cracking",
    description:
      "Analyse statique et dynamique de binaires, contournement de protections, écriture de keygens. Couvre ELF, PE, .NET, APK, WASM et autres.",
    exploitDescription: "Reverse, crackmes, keygens",
  },
  {
    slug: "webclient",
    name: "WebClient",
    description:
      "Failles côté client : contournement de SOP, exploitation du DOM, attaques sur le navigateur.",
    exploitDescription: "XSS, CSRF, prototype pollution",
  },
  {
    slug: "webserver",
    name: "WebServer",
    description:
      "Failles côté serveur : injections, désérialisation, path traversal, escalade de privilèges applicative.",
    exploitDescription: "SSRF, SQLi, RCE",
  },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const cat of DEFAULTS) {
      await this.prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }
    this.logger.log(`Seeded ${DEFAULTS.length} default categories (no-op if present)`);
  }

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
}
