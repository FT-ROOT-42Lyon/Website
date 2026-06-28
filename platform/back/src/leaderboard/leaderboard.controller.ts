import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { PrismaService } from "../core/prisma/prisma.service";
import { JwtAuthGuard } from "../core/guards/jwt-auth.guard";

interface RawUser {
  id: number;
  login: string;
  displayName: string | null;
  avatarUrl: string | null;
}

function entry(rank: number, score: number, user: RawUser) {
  return { rank, score, user };
}

@Controller("leaderboard")
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly prisma: PrismaService) {}

  // Global ranking — all users by their lifetime score (desc).
  @Get()
  async global() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ score: "desc" }, { login: "asc" }],
      select: {
        id: true,
        login: true,
        displayName: true,
        avatarUrl: true,
        score: true,
      },
    });
    return users.map((u, i) =>
      entry(i + 1, u.score, {
        id: u.id,
        login: u.login,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      }),
    );
  }

  // Per-bracket ranking — only members of this bracket, sorted by bracket score.
  @Get("brackets/:slug")
  async byBracket(@Param("slug") slug: string) {
    const bracket = await this.prisma.bracket.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, description: true },
    });
    if (!bracket) throw new NotFoundException("Bracket not found");

    const members = await this.prisma.bracketMember.findMany({
      where: { bracketId: bracket.id },
      orderBy: [{ score: "desc" }, { joinedAt: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            login: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      bracket,
      entries: members.map((m, i) => entry(i + 1, m.score, m.user)),
    };
  }
}
