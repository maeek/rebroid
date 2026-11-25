import { Module } from "@nestjs/common";
import { ExternalAdbModule } from "../external-adb/external-adb.module";
import {
  ExternalDisplayAdb,
  ExternalDisplayAdbRunner,
} from "../external-adb/external-display-adb";
import { AdbModule } from "./adb.module";
import { AdbService } from "./adb.service";

const external = process.env.EXTERNAL_ADB_ENABLED === "true";

@Module({
  imports: external ? [ExternalAdbModule] : [AdbModule],
  providers: external
    ? [
        ExternalDisplayAdbRunner,
        ExternalDisplayAdb,
        { provide: AdbService, useExisting: ExternalDisplayAdb },
      ]
    : [],
  exports: external ? [AdbService] : [AdbModule],
})
export class DisplayAdbModule {}
