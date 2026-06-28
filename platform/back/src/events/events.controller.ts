import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomBytes } from "crypto";
import { extname } from "path";
import { EventsService } from "./events.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";
import { UPLOADS_DIR } from "../core/uploads";

function serialize(e: {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  bracket: { slug: string; name: string } | null;
}) {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description,
    imageUrl: e.imageUrl,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    bracket: e.bracket,
  };
}

const imageInterceptor = FileInterceptor("image", {
  storage: diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      cb(null, `event-${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function parseDate(raw: string | undefined, label: string): Date {
  if (!raw) throw new BadRequestException(`${label} required`);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return d;
}

function parseOptionalDate(raw: string | undefined, label: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return d;
}

// Public reads, staff-only writes. Mirrors the categories pattern so the home
// page can list events without requiring login.
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  async list() {
    const items = await this.events.list();
    return items.map(serialize);
  }

  @Get(":slug")
  async bySlug(@Param("slug") slug: string) {
    return serialize(await this.events.getBySlug(slug));
  }

  @Post()
  @UseGuards(JwtAuthGuard, StaffGuard)
  @UseInterceptors(imageInterceptor)
  async create(
    @UploadedFile() image: Express.Multer.File | undefined,
    @Body()
    body: {
      name?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      bracketSlug?: string;
    },
  ) {
    const name = (body.name ?? "").trim();
    const description = (body.description ?? "").trim();
    if (!name || !description) {
      throw new BadRequestException("name and description are required");
    }

    return serialize(
      await this.events.create({
        name,
        description,
        startsAt: parseDate(body.startsAt, "startsAt"),
        endsAt: parseDate(body.endsAt, "endsAt"),
        imageFilename: image?.filename ?? null,
        bracketSlug: body.bracketSlug?.trim() || null,
      }),
    );
  }

  @Patch(":slug")
  @UseGuards(JwtAuthGuard, StaffGuard)
  @UseInterceptors(imageInterceptor)
  async update(
    @Param("slug") slug: string,
    @UploadedFile() image: Express.Multer.File | undefined,
    @Body()
    body: {
      name?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      // present-but-empty clears the bracket; absent leaves it alone.
      bracketSlug?: string;
    },
  ) {
    return serialize(
      await this.events.update(slug, {
        name: body.name?.trim() || undefined,
        description: body.description?.trim() || undefined,
        startsAt: parseOptionalDate(body.startsAt, "startsAt"),
        endsAt: parseOptionalDate(body.endsAt, "endsAt"),
        imageFilename: image?.filename,
        bracketSlug: body.bracketSlug,
      }),
    );
  }
}
