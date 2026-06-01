import { Module } from "@nestjs/common";
import { AdbModule } from "../adb/adb.module";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { ScrcpyService } from "./scrcpy.service";

@Module({
  imports: [AdbModule],
  providers: [ScrcpyService, SidecarConfigService],
  exports: [ScrcpyService],
})
export class ScrcpyModule {}
