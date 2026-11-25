import { Module } from "@nestjs/common";
import { DisplayModule } from "./display/display.module";
import { HealthController } from "./health/health.controller";
import { SidecarCoreModule } from "./shared/sidecar-core.module";
import { ExternalAdbModule } from "./external-adb/external-adb.module";

@Module({
  imports: [SidecarCoreModule, ExternalAdbModule, DisplayModule],
  controllers: [HealthController],
})
export class AppModule {}
