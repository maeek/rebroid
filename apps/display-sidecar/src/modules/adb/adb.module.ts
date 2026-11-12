import { Module } from "@nestjs/common";
import { AdbController } from "./adb.controller";
import { AdbService } from "./adb.service";
import { AdbCommandRunner } from "./adb-command-runner";
import { AdbTextService } from "./adb-text.service";

@Module({
  controllers: [AdbController],
  providers: [AdbCommandRunner, AdbService, AdbTextService],
  exports: [AdbService],
})
export class AdbModule {}
