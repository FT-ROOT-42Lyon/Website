import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsString, MinLength } from "class-validator";
import { diskStorage } from "multer";
import { randomBytes } from "crypto";
import { extname } from "path";
import { EventsService } from "./events.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";
import { UPLOADS_DIR } from "../core/uploads";

class AddMemberDto {
  @IsString()
  login!: string;
}

class AddChallengeDto {
  @IsString()
  @MinLength(1)
  challengeSlug!: string;
}

interface EventRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  _count?: { members: number; challenges: number };
}

function serializeSummary(e: EventRow) {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    description: e.description,
    imageUrl: e.imageUrl,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    memberCount: e._count?.members ?? 0,
    challengeCount: e._count?.challenges ?? 0,
  };
}

function serializeMember(m: {
  id: number;
  score: number;
  joinedAt: Date;
  user: {
    id: number;
    login: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}) {
  return {
    id: m.id,
    score: m.score,
    joinedAt: m.joinedAt.toISOString(),
    user: m.user,
  };
}

function serializeEventChallenge(ec: {
  id: number;
  challenge: {
    id: number;
    slug: string;
    title: string;
    score: number;
    difficulty: string;
    category: { slug: string; name: string };
  };
}) {
  return {
    id: ec.id,
    challenge: ec.challenge,
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

@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // List + detail are public so the home page and nav dropdowns work for
  // anonymous visitors. Mutations are staff-only.
  @Get()
  async list() {
    const items = await this.events.list();
    return items.map(serializeSummary);
  }

  @Get(":slug")
  async detail(@Param("slug") slug: string) {
    const e = await this.events.getDetail(slug);
    return {
      ...serializeSummary(e),
      members: e.members.map(serializeMember),
      challenges: e.challenges.map(serializeEventChallenge),
    };
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
    },
  ) {
    const name = (body.name ?? "").trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }

    return serializeSummary(
      await this.events.create({
        name,
        description: (body.description ?? "").trim(),
        startsAt: parseDate(body.startsAt, "startsAt"),
        endsAt: parseDate(body.endsAt, "endsAt"),
        imageFilename: image?.filename ?? null,
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
    },
  ) {
    return serializeSummary(
      await this.events.update(slug, {
        name: body.name?.trim() || undefined,
        // empty string overwrites description with "" (allowed); undefined keeps current.
        description: body.description === undefined ? undefined : body.description.trim(),
        startsAt: parseOptionalDate(body.startsAt, "startsAt"),
        endsAt: parseOptionalDate(body.endsAt, "endsAt"),
        imageFilename: image?.filename,
      }),
    );
  }

  @Delete(":slug")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, StaffGuard)
  async remove(@Param("slug") slug: string) {
    await this.events.delete(slug);
  }

  // ─── Members management ────────────────────────────────────────────────
  @Post(":slug/members")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async addMember(@Param("slug") slug: string, @Body() body: AddMemberDto) {
    return serializeMember(await this.events.addMember(slug, body.login));
  }

  @Delete(":slug/members/:userId")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, StaffGuard)
  async removeMember(
    @Param("slug") slug: string,
    @Param("userId", ParseIntPipe) userId: number,
  ) {
    await this.events.removeMember(slug, userId);
  }

  // ─── Challenges association ────────────────────────────────────────────
  @Post(":slug/challenges")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async addChallenge(
    @Param("slug") slug: string,
    @Body() body: AddChallengeDto,
  ) {
    await this.events.addChallenge(slug, body.challengeSlug);
    return { ok: true };
  }

  @Delete(":slug/challenges/:challengeSlug")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, StaffGuard)
  async removeChallenge(
    @Param("slug") slug: string,
    @Param("challengeSlug") challengeSlug: string,
  ) {
    await this.events.removeChallenge(slug, challengeSlug);
  }
}
