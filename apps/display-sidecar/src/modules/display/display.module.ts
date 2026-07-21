import { Module } from "@nestjs/common";
import { AdbModule } from "../adb/adb.module";
import { ScrcpyModule } from "../scrcpy/scrcpy.module";
import { DisplayControlGateway } from "./display-control.gateway";
import { DisplayControlService } from "./display-control.service";
import { DisplayController } from "./display.controller";
import { DisplayPublicController } from "./display-public.controller";
import { DisplayViewerAssetsController } from "./display-viewer-assets.controller";
import { DisplayGateway } from "./display.gateway";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

@Module({
  imports: [AdbModule, ScrcpyModule],
  controllers: [
    DisplayController,
    DisplayPublicController,
    DisplayViewerAssetsController,
  ],
  providers: [
    DisplayControlGateway,
    DisplayControlService,
    DisplayGateway,
    DisplaySessionService,
    DisplayWebrtcService,
  ],
  exports: [DisplaySessionService],
})
export class DisplayModule {}
