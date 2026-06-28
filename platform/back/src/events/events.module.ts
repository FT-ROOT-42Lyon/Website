import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { StaffGuard } from "../core/guards/staff.guard";

@Module({
  providers: [EventsService, StaffGuard],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
