import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { StaffGuard } from "../core/guards/staff.guard";

@Module({
  providers: [UsersService, StaffGuard],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
