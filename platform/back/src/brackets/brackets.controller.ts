import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { BracketsService } from "./brackets.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";

class CreateBracketDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description!: string;
}

class UpdateBracketDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;
}

class AddMemberDto {
  @IsString()
  login!: string;

  @IsInt()
  @Min(0)
  score!: number;
}

class UpdateMemberDto {
  @IsInt()
  @Min(0)
  score!: number;
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

function serializeBracket(b: {
  id: number;
  slug: string;
  name: string;
  description: string;
  createdAt: Date;
  _count?: { members: number };
}) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    memberCount: b._count?.members ?? 0,
    createdAt: b.createdAt.toISOString(),
  };
}

@Controller("brackets")
export class BracketsController {
  constructor(private readonly brackets: BracketsService) {}

  @Get()
  async list() {
    const items = await this.brackets.list();
    return items.map(serializeBracket);
  }

  @Get(":slug")
  @UseGuards(JwtAuthGuard)
  async detail(@Param("slug") slug: string) {
    const b = await this.brackets.getDetail(slug);
    return {
      ...serializeBracket(b),
      members: b.members.map(serializeMember),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async create(@Body() body: CreateBracketDto) {
    return serializeBracket(await this.brackets.create(body));
  }

  @Patch(":slug")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async update(@Param("slug") slug: string, @Body() body: UpdateBracketDto) {
    return serializeBracket(await this.brackets.update(slug, body));
  }

  @Post(":slug/members")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async addMember(@Param("slug") slug: string, @Body() body: AddMemberDto) {
    return serializeMember(
      await this.brackets.addMember(slug, body.login, body.score),
    );
  }

  @Patch(":slug/members/:userId")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async updateMember(
    @Param("slug") slug: string,
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: UpdateMemberDto,
  ) {
    await this.brackets.updateMemberScore(slug, userId, body.score);
    return { ok: true };
  }

  @Delete(":slug/members/:userId")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async removeMember(
    @Param("slug") slug: string,
    @Param("userId", ParseIntPipe) userId: number,
  ) {
    await this.brackets.removeMember(slug, userId);
    return { ok: true };
  }
}
