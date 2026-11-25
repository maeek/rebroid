import { Module } from "@nestjs/common";
import { DisplayAdbModule } from "../adb/display-adb.module";
import { ExternalAdbModule } from "../external-adb/external-adb.module";
import { ScrcpyModule } from "../scrcpy/scrcpy.module";
import { DisplayControlGateway } from "./display-control.gateway";
import { DisplayControlService } from "./display-control.service";
import { DisplayController } from "./display.controller";
import { DisplayPublicController } from "./display-public.controller";
import { DisplayViewerAssetsController } from "./display-viewer-assets.controller";
import { DisplayGateway } from "./display.gateway";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";
import { DisplaySessionLifecycleService } from "./display-session-lifecycle.service";
import { DisplayViewerAccessService } from "./display-viewer-access.service";
import { ExternalDisplayToolsController } from "./external-display-tools.controller";
import { ExternalAutomationController } from "./external-automation.controller";

@Module({
  imports: [DisplayAdbModule, ScrcpyModule, ExternalAdbModule],
  controllers: [
    DisplayController,
    DisplayPublicController,
    DisplayViewerAssetsController,
    ExternalDisplayToolsController,
    ExternalAutomationController,
  ],
  providers: [
    DisplayControlGateway,
    DisplayControlService,
    DisplayGateway,
    DisplaySessionService,
    DisplaySessionLifecycleService,
    DisplayViewerAccessService,
    DisplayWebrtcService,
  ],
  exports: [DisplaySessionService],
})
export class DisplayModule {}
