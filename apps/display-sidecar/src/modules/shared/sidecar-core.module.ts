import { Global, Module } from "@nestjs/common";
import { SidecarAuthGuard } from "./sidecar-auth.guard";
import { SidecarConfigService } from "./sidecar-config.service";
import { SidecarFeatureController } from "./sidecar-feature.controller";
import { SidecarFeatureService } from "./sidecar-feature.service";

@Global()
@Module({
  controllers: [SidecarFeatureController],
  providers: [SidecarAuthGuard, SidecarConfigService, SidecarFeatureService],
  exports: [SidecarAuthGuard, SidecarConfigService, SidecarFeatureService],
})
export class SidecarCoreModule {}
