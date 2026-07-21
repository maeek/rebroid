import { Module } from "@nestjs/common";
import { AdbModule } from "../adb/adb.module";
import { ScrcpyService } from "./scrcpy.service";

@Module({
  imports: [AdbModule],
  providers: [ScrcpyService],
  exports: [ScrcpyService],
})
export class ScrcpyModule {}
