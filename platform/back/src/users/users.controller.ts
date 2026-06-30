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
  UseGuards,
} from "@nestjs/common";
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";
import {
  AuthUser,
  CurrentUser,
} from "../core/decorators/current-user.decorator";

class SetRoleDto {
  @IsBoolean()
  isStaff!: boolean;
}

class CreateFromIntraDto {
  @IsString()
  @MinLength(1)
  login!: string;
}

class AddSolveDto {
  @IsString()
  @MinLength(1)
  challengeSlug!: string;

  // Optional ISO datetime — when omitted the backend uses "now". Allows staff
  // to back-date a validation so it falls inside an event window.
  @IsOptional()
  @IsISO8601()
  solvedAt?: string;
}

function serialize(user: {
  id: number;
  login: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  isStaff: boolean;
  score: number;
  rootmeId: number | null;
  rootmeUsername: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    login: user.login,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isStaff: user.isStaff,
    score: user.score,
    rootmeId: user.rootmeId,
    rootmeUsername: user.rootmeUsername,
    createdAt: user.createdAt.toISOString(),
  };
}

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // /me must be declared before /:login, otherwise the param route would
  // greedily match "me" and the literal route never fires.
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthUser) {
    return serialize(await this.users.getById(current.id));
  }

  @Get()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async list() {
    const users = await this.users.list();
    return users.map(serialize);
  }

  // Pre-create a user from their 42 login (admin pre-population). The actual
  // user can then log in via OAuth and the row will be matched by ft42Id.
  @Post()
  @UseGuards(JwtAuthGuard, StaffGuard)
  async createFromIntra(@Body() body: CreateFromIntraDto) {
    return serialize(await this.users.createFromIntra(body.login));
  }

  @Get(":login")
  @UseGuards(JwtAuthGuard)
  async byLogin(@Param("login") login: string) {
    return serialize(await this.users.getByLogin(login));
  }

  // Enriched profile payload: solves with running total, difficulty + category
  // stats, leaderboard neighborhood. Used by the profile page.
  @Get(":login/stats")
  @UseGuards(JwtAuthGuard)
  async stats(@Param("login") login: string) {
    return this.users.getStats(login);
  }

  // Toggle a user's staff status. Self-demotion is blocked on purpose —
  // otherwise the last staff member could lock themselves out.
  @Patch(":login/role")
  @UseGuards(JwtAuthGuard, StaffGuard)
  async setRole(
    @CurrentUser() current: AuthUser,
    @Param("login") login: string,
    @Body() body: SetRoleDto,
  ) {
    const target = await this.users.getByLogin(login);
    if (target.id === current.id) {
      throw new BadRequestException(
        "Tu ne peux pas changer ton propre rôle",
      );
    }
    return serialize(await this.users.setStaff(target.id, body.isStaff));
  }

  // Staff-side: manually validate a challenge for a user. Score is credited
  // identically to a real flag submission.
  @Post(":login/solves")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, StaffGuard)
  async addSolve(
    @Param("login") login: string,
    @Body() body: AddSolveDto,
  ) {
    await this.users.addSolve(
      login,
      body.challengeSlug,
      body.solvedAt ? new Date(body.solvedAt) : undefined,
    );
  }

  // Staff-side: revoke a solve. Score is decremented by the amount that was
  // awarded at solve time.
  @Delete(":login/solves/:challengeSlug")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, StaffGuard)
  async removeSolve(
    @Param("login") login: string,
    @Param("challengeSlug") challengeSlug: string,
  ) {
    await this.users.removeSolve(login, challengeSlug);
  }

  // Delete a user. Self-deletion is blocked so a staff member can't lock
  // themselves out by mistake.
  @Delete(":login")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, StaffGuard)
  async remove(
    @CurrentUser() current: AuthUser,
    @Param("login") login: string,
  ) {
    const target = await this.users.getByLogin(login);
    if (target.id === current.id) {
      throw new BadRequestException(
        "Tu ne peux pas supprimer ton propre compte",
      );
    }
    await this.users.delete(login);
  }
}
