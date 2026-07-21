import { Module } from "@nestjs/common";
import { AdbModule } from "./adb/adb.module";
import { DisplayModule } from "./display/display.module";
import { HealthController } from "./health/health.controller";
import { SidecarCoreModule } from "./shared/sidecar-core.module";

@Module({
  imports: [SidecarCoreModule, AdbModule, DisplayModule],
  controllers: [HealthController],
})
export class AppModule {}
