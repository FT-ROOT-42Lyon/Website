import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { ftIntraAuthCallbackPath } from "@ft-root/shared";
import { PrismaService } from "../core/prisma/prisma.service";
import { env } from "../core/env";

// Subset of the /v2/me payload we actually use. The 42 API returns a lot more.
const Me42Schema = z.object({
  id: z.number(),
  login: z.string(),
  email: z.string().email(),
  displayname: z.string().nullable().optional(),
  image: z
    .object({ link: z.string().nullable().optional() })
    .nullable()
    .optional(),
});

const TokenSchema = z.object({ access_token: z.string() });

const STATE_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // ─── 42 OAuth ──────────────────────────────────────────────────────────────

  async get42LoginUrl(): Promise<string> {
    const state = randomBytes(32).toString("hex");

    await this.prisma.oAuthState.create({
      data: {
        state,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });

    const redirectUri = encodeURIComponent(
      env.BASE_FRONT_URL + ftIntraAuthCallbackPath,
    );
    return (
      "https://api.intra.42.fr/oauth/authorize" +
      `?client_id=${env.API42_CLIENT_UID}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=public` +
      `&state=${state}`
    );
  }

  async handle42Callback(
    code: string,
    state: string,
    userAgent: string | undefined,
    ipAddress: string | undefined,
  ) {
    await this.consumeOAuthState(state);

    const userData = await this.fetch42UserInfo(code);

    const user = await this.prisma.user.upsert({
      where: { ft42Id: userData.id },
      update: {
        login: userData.login,
        email: userData.email,
        displayName: userData.displayname ?? userData.login,
        avatarUrl: userData.image?.link ?? null,
      },
      create: {
        ft42Id: userData.id,
        login: userData.login,
        email: userData.email,
        displayName: userData.displayname ?? userData.login,
        avatarUrl: userData.image?.link ?? null,
      },
    });

    return {
      accessToken: await this.signAccessToken(user.id),
      refreshToken: await this.createRefreshSession(user.id, userAgent, ipAddress),
    };
  }

  // ─── Tokens ────────────────────────────────────────────────────────────────

  async refresh(
    userId: number,
    jti: string | undefined,
    userAgent: string | undefined,
    ipAddress: string | undefined,
  ) {
    if (!jti) throw new UnauthorizedException("Invalid refresh token");

    const session = await this.prisma.session.findUnique({ where: { jti } });
    if (!session || session.userId !== userId || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.session.delete({ where: { id: session.id } });

    return {
      accessToken: await this.signAccessToken(userId),
      refreshToken: await this.createRefreshSession(userId, userAgent, ipAddress),
    };
  }

  async logout(userId: number, jti: string | undefined) {
    if (!jti) return;
    const session = await this.prisma.session.findUnique({ where: { jti } });
    if (session && session.userId === userId) {
      await this.prisma.session.delete({ where: { id: session.id } });
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async consumeOAuthState(state: string) {
    const row = await this.prisma.oAuthState.findUnique({ where: { state } });
    if (!row || row.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired OAuth state");
    }
    await this.prisma.oAuthState.delete({ where: { id: row.id } });
  }

  private async fetch42UserInfo(code: string) {
    const redirectUri = env.BASE_FRONT_URL + ftIntraAuthCallbackPath;

    let tokenJson: unknown;
    let userJson: unknown;
    try {
      const tokenRes = await fetch("https://api.intra.42.fr/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: env.API42_CLIENT_UID,
          client_secret: env.API42_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
        }),
      });
      tokenJson = await tokenRes.json();

      const token = TokenSchema.parse(tokenJson);

      const meRes = await fetch("https://api.intra.42.fr/v2/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      userJson = await meRes.json();
    } catch {
      throw new InternalServerErrorException(
        "Failed to communicate with 42 intra",
      );
    }

    const parsed = Me42Schema.safeParse(userJson);
    if (!parsed.success) {
      throw new UnauthorizedException("Unexpected response from 42 intra");
    }
    return parsed.data;
  }

  private async signAccessToken(userId: number): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId },
      { secret: env.JWT_SECRET, expiresIn: "15m" },
    );
  }

  private async createRefreshSession(
    userId: number,
    userAgent: string | undefined,
    ipAddress: string | undefined,
  ): Promise<string> {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.session.create({
      data: {
        userId,
        jti,
        userAgent: userAgent ?? null,
        ipAddress: ipAddress ?? null,
        expiresAt,
      },
    });

    return this.jwt.signAsync(
      { sub: userId, jti },
      { secret: env.JWT_REFRESH_SECRET, expiresIn: "7d" },
    );
  }
}
