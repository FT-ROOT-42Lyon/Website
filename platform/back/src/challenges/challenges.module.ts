import { Module } from "@nestjs/common";
import { ChallengesService } from "./challenges.service";
import { ChallengesController } from "./challenges.controller";
import { StaffGuard } from "../core/guards/staff.guard";

@Module({
  providers: [ChallengesService, StaffGuard],
  controllers: [ChallengesController],
  exports: [ChallengesService],
})
export class ChallengesModule {}
