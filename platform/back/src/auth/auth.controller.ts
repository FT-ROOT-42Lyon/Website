import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { IsString } from "class-validator";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { JwtRefreshGuard } from "../core/guards/jwt-auth.guard";
import {
  AuthUser,
  CurrentUser,
} from "../core/decorators/current-user.decorator";
import { env } from "../core/env";

class CallbackDto {
  @IsString()
  code!: string;

  @IsString()
  state!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Builds the OAuth URL the front will redirect to. Keeping it server-side
  // means the CSRF state is generated and persisted before the user leaves.
  @Get("42/url")
  async get42Url() {
    const url = await this.authService.get42LoginUrl();
    return { url };
  }

  // Called by the front when it receives `?code=&state=` from the 42 redirect.
  @Post("42/callback")
  async callback(
    @Body() body: CallbackDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.handle42Callback(
      body.code,
      body.state,
      req.headers["user-agent"],
      req.ip,
    );
    setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post("refresh")
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.refresh(
      user.id,
      user.jti,
      req.headers["user-agent"],
      req.ip,
    );
    setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Post("logout")
  @UseGuards(JwtRefreshGuard)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id, user.jti);
    clearRefreshCookie(res);
    return { ok: true };
  }
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "prod",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.cookie("refresh_token", "", {
    httpOnly: true,
    secure: env.NODE_ENV === "prod",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}
