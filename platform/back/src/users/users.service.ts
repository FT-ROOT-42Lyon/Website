import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async getByLogin(login: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async list() {
    return this.prisma.user.findMany({
      orderBy: [{ isStaff: "desc" }, { login: "asc" }],
    });
  }
}
