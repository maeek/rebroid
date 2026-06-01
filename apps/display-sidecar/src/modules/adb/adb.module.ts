import { Module } from "@nestjs/common";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { AdbController } from "./adb.controller";
import { AdbService } from "./adb.service";

@Module({
  controllers: [AdbController],
  providers: [AdbService, SidecarAuthGuard, SidecarConfigService],
  exports: [AdbService],
})
export class AdbModule {}
