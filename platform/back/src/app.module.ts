import { Module } from "@nestjs/common";
import { PrismaModule } from "./core/prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CategoriesModule } from "./categories/categories.module";
import { ChallengesModule } from "./challenges/challenges.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { EventsModule } from "./events/events.module";
import { RootmeModule } from "./rootme/rootme.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ChallengesModule,
    LeaderboardModule,
    EventsModule,
    RootmeModule,
  ],
})
export class AppModule {}
