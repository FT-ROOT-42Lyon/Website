import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../decorators/current-user.decorator";

// Must run AFTER JwtAuthGuard — relies on `req.user` already being populated.
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isStaff: true },
    });

    if (!user?.isStaff) throw new ForbiddenException("Staff only");
    return true;
  }
}
