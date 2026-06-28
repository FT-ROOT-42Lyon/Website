import { Module } from "@nestjs/common";
import { PrismaModule } from "./core/prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { ChallengesModule } from "./challenges/challenges.module";
import { BracketsModule } from "./brackets/brackets.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ChallengesModule,
    BracketsModule,
    LeaderboardModule,
  ],
})
export class AppModule {}
