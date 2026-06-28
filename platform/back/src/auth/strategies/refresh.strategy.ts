import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { Request } from "express";
import { env } from "../../core/env";
import { AuthUser } from "../../core/decorators/current-user.decorator";

interface RefreshPayload {
  sub: number;
  jti: string;
}

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, "jwt-refresh") {
  constructor() {
    super({
      jwtFromRequest: (req: Request) =>
        (req.cookies?.refresh_token as string | undefined) ?? null,
      secretOrKey: env.JWT_REFRESH_SECRET,
      passReqToCallback: false,
    });
  }

  validate(payload: RefreshPayload): AuthUser {
    return { id: payload.sub, jti: payload.jti };
  }
}
