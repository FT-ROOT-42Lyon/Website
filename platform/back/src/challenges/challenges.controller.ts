import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Difficulty } from "@prisma/client";
import { IsString, MaxLength, MinLength } from "class-validator";
import { diskStorage } from "multer";
import { randomBytes } from "crypto";
import { extname } from "path";
import { ChallengesService, NewFile, NewLink } from "./challenges.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";
import { UPLOADS_DIR } from "../core/uploads";
import {
  AuthUser,
  CurrentUser,
} from "../core/decorators/current-user.decorator";

const VALID_DIFFICULTIES: Difficulty[] = [
  "VERY_EASY",
  "EASY",
  "MEDIUM",
  "HARD",
  "VERY_HARD",
];

class SubmitFlagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  flag!: string;
}

function serializeResource(r: {
  id: number;
  type: "FILE" | "LINK";
  label: string;
  target: string;
  position: number;
}) {
  return {
    id: r.id,
    type: r.type,
    label: r.label,
    href: r.type === "FILE" ? `/uploads/${r.target}` : r.target,
    position: r.position,
  };
}

interface SerializableChallenge {
  id: number;
  slug: string;
  title: string;
  description: string;
  score: number;
  difficulty: Difficulty;
  flagHash?: string | null;
  createdAt: Date;
  category?: { slug: string; name: string };
  resources?: Array<{
    id: number;
    type: "FILE" | "LINK";
    label: string;
    target: string;
    position: number;
  }>;
  _count?: { resources: number };
  solves?: Array<{ id: number }>;
}

function serializeChallenge(c: SerializableChallenge) {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    description: c.description,
    score: c.score,
    difficulty: c.difficulty,
    createdAt: c.createdAt.toISOString(),
    solved: (c.solves?.length ?? 0) > 0,
    hasFlag: Boolean(c.flagHash),
    category: c.category
      ? { slug: c.category.slug, name: c.category.name }
      : undefined,
    resources: c.resources ? c.resources.map(serializeResource) : undefined,
    resourceCount: c._count?.resources,
  };
}

// ─── Shared multer config ──────────────────────────────────────────────────
const uploadInterceptor = FilesInterceptor("files", 10, {
  storage: diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${randomBytes(6).toString("hex")}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function parseJsonArray<T>(raw: string | undefined, validate: (v: unknown) => v is T[]): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new BadRequestException("Invalid JSON payload");
  }
}

const isLinkArr = (v: unknown): v is NewLink[] =>
  Array.isArray(v) &&
  v.every(
    (l: any) =>
      l &&
      typeof l.label === "string" &&
      typeof l.url === "string" &&
      /^https?:\/\//i.test(l.url),
  );

const isStringArr = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((s) => typeof s === "string");

const isNumberArr = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => Number.isInteger(n));

function buildFileSlots(
  files: Express.Multer.File[] | undefined,
  fileLabelsJson: string | undefined,
): NewFile[] {
  const fileLabels = parseJsonArray(fileLabelsJson, isStringArr);
  return (files ?? []).map((f, i) => ({
    label: fileLabels[i]?.trim() || f.originalname,
    storedFilename: f.filename,
  }));
}

function parseScore(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException("Invalid score");
  }
  return Math.floor(n);
}

function parseDifficulty(raw: string | undefined): Difficulty | undefined {
  if (!raw) return undefined;
  if (!VALID_DIFFICULTIES.includes(raw as Difficulty)) {
    throw new BadRequestException("Invalid difficulty");
  }
  return raw as Difficulty;
}

@Controller("challenges")
@UseGuards(JwtAuthGuard)
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.challenges.list(user.id);
    return items.map(serializeChallenge);
  }

  @Get("by-category/:slug")
  async byCategory(
    @CurrentUser() user: AuthUser,
    @Param("slug") slug: string,
  ) {
    const items = await this.challenges.listByCategorySlug(slug, user.id);
    return items.map(serializeChallenge);
  }

  @Get(":slug")
  async bySlug(@CurrentUser() user: AuthUser, @Param("slug") slug: string) {
    return serializeChallenge(
      await this.challenges.getBySlug(slug, user.id),
    );
  }

  @Post(":slug/submit")
  async submit(
    @CurrentUser() user: AuthUser,
    @Param("slug") slug: string,
    @Body() body: SubmitFlagDto,
  ) {
    return this.challenges.submitFlag(slug, user.id, body.flag);
  }

  @Post()
  @UseGuards(StaffGuard)
  @UseInterceptors(uploadInterceptor)
  async create(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body()
    body: {
      title?: string;
      description?: string;
      categorySlug?: string;
      score?: string;
      difficulty?: string;
      flag?: string;
      links?: string;
      fileLabels?: string;
    },
  ) {
    const title = (body.title ?? "").trim();
    const description = (body.description ?? "").trim();
    const categorySlug = (body.categorySlug ?? "").trim();
    const flag = (body.flag ?? "").trim();
    if (!title || !categorySlug) {
      throw new BadRequestException(
        "title and categorySlug are required",
      );
    }
    if (!flag) {
      throw new BadRequestException("Le flag est requis à la création");
    }

    const score = parseScore(body.score) ?? 100;
    const difficulty = parseDifficulty(body.difficulty) ?? "MEDIUM";
    const links = parseJsonArray(body.links, isLinkArr);
    const mappedFiles = buildFileSlots(files, body.fileLabels);

    return serializeChallenge(
      await this.challenges.create({
        title,
        description,
        categorySlug,
        score,
        difficulty,
        flag,
        files: mappedFiles,
        links,
      }),
    );
  }

  @Patch(":slug")
  @UseGuards(StaffGuard)
  @UseInterceptors(uploadInterceptor)
  async update(
    @Param("slug") slug: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body()
    body: {
      title?: string;
      description?: string;
      categorySlug?: string;
      score?: string;
      difficulty?: string;
      flag?: string;
      keepResourceIds?: string;
      newLinks?: string;
      fileLabels?: string;
    },
  ) {
    const keepResourceIds = parseJsonArray(body.keepResourceIds, isNumberArr);
    const newLinks = parseJsonArray(body.newLinks, isLinkArr);
    const newFiles = buildFileSlots(files, body.fileLabels);

    return serializeChallenge(
      await this.challenges.update(slug, {
        title: body.title?.trim() || undefined,
        description: body.description?.trim() || undefined,
        categorySlug: body.categorySlug?.trim() || undefined,
        score: parseScore(body.score),
        difficulty: parseDifficulty(body.difficulty),
        flag: body.flag?.trim() ? body.flag.trim() : undefined,
        keepResourceIds,
        newFiles,
        newLinks,
      }),
    );
  }

  @Delete(":slug")
  @HttpCode(204)
  @UseGuards(StaffGuard)
  async remove(@Param("slug") slug: string) {
    await this.challenges.delete(slug);
  }
}
