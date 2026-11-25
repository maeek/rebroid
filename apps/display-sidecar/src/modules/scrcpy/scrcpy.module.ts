import { Module } from "@nestjs/common";
import { DisplayAdbModule } from "../adb/display-adb.module";
import { ScrcpyService } from "./scrcpy.service";

@Module({
  imports: [DisplayAdbModule],
  providers: [ScrcpyService],
  exports: [ScrcpyService],
})
export class ScrcpyModule {}
