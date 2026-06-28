import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean } from "class-validator";
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

function serialize(user: {
  id: number;
  login: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  isStaff: boolean;
  score: number;
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
}
