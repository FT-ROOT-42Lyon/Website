import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface AuthUser {
  id: number;
  jti?: string;
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser;
  },
);
