import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { RootmeService } from "./rootme.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";
import { StaffGuard } from "../core/guards/staff.guard";
import {
  AuthUser,
  CurrentUser,
} from "../core/decorators/current-user.decorator";

class LinkDto {
  @IsString()
  @MinLength(1)
  identifier!: string; // numeric Root-Me id OR username
}

// Root-Me categories and challenges live in the regular categories / challenges
// tables (with a `rootmeId` set), so reads go through /api/categories and
// /api/challenges like any other content. This controller only carries the
// linking + sync side of things.
@Controller("rootme")
@UseGuards(JwtAuthGuard)
export class RootmeController {
  constructor(private readonly rootme: RootmeService) {}

  @Post("link")
  async link(@CurrentUser() user: AuthUser, @Body() body: LinkDto) {
    const updated = await this.rootme.link(user.id, body.identifier);
    try {
      await this.rootme.syncUserSolves(user.id);
    } catch {
      // surface the link success even if the initial sync hiccups
    }
    return {
      rootmeId: updated.rootmeId,
      rootmeUsername: updated.rootmeUsername,
    };
  }

  @Delete("link")
  @HttpCode(204)
  async unlink(@CurrentUser() user: AuthUser) {
    await this.rootme.unlink(user.id);
  }

  @Post("sync-mine")
  async syncMine(@CurrentUser() user: AuthUser) {
    const added = await this.rootme.syncUserSolves(user.id);
    return { added };
  }

  @Post("sync")
  @UseGuards(StaffGuard)
  async syncAll() {
    return this.rootme.syncAll();
  }
}
