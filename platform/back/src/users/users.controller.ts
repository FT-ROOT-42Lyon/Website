import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";
import {
  AuthUser,
  CurrentUser,
} from "../core/decorators/current-user.decorator";

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
}
