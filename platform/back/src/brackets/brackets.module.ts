import { Module } from "@nestjs/common";
import { BracketsService } from "./brackets.service";
import { BracketsController } from "./brackets.controller";
import { StaffGuard } from "../core/guards/staff.guard";

@Module({
  providers: [BracketsService, StaffGuard],
  controllers: [BracketsController],
  exports: [BracketsService],
})
export class BracketsModule {}
