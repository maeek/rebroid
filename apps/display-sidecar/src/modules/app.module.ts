import { Module } from "@nestjs/common";
import { AdbModule } from "./adb/adb.module";
import { DisplayModule } from "./display/display.module";
import { HealthController } from "./health/health.controller";
import { SidecarConfigService } from "./shared/sidecar-config.service";

@Module({
  imports: [AdbModule, DisplayModule],
  controllers: [HealthController],
  providers: [SidecarConfigService],
})
export class AppModule {}
