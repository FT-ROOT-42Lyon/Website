import { Module } from "@nestjs/common";
import { RootmeService } from "./rootme.service";
import { RootmeController } from "./rootme.controller";
import { StaffGuard } from "../core/guards/staff.guard";

@Module({
  providers: [RootmeService, StaffGuard],
  controllers: [RootmeController],
  exports: [RootmeService],
})
export class RootmeModule {}
