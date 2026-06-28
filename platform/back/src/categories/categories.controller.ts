import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { CategoriesService } from "./categories.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";

class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  exploitDescription!: string;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  exploitDescription?: string;
}

function serialize(c: {
  id: number;
  slug: string;
  name: string;
  description: string;
  exploitDescription: string;
  createdAt: Date;
  _count?: { challenges: number };
}) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    exploitDescription: c.exploitDescription,
    challengeCount: c._count?.challenges ?? 0,
    createdAt: c.createdAt.toISOString(),
  };
}

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async list() {
    const cats = await this.categories.list();
    return cats.map(serialize);
  }

  @Get(":slug")
  async bySlug(@Param("slug") slug: string) {
    return serialize(await this.categories.getBySlug(slug));
  }

  @Post()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async create(@Body() body: CreateCategoryDto) {
    return serialize(await this.categories.create(body));
  }

  @Patch(":slug")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async update(
    @Param("slug") slug: string,
    @Body() body: UpdateCategoryDto,
  ) {
    return serialize(await this.categories.update(slug, body));
  }
}
