import { Module } from "@nestjs/common";
import { AdbController } from "./adb.controller";
import { AdbService } from "./adb.service";
import { AdbCommandRunner } from "./adb-command-runner";

@Module({
  controllers: [AdbController],
  providers: [AdbCommandRunner, AdbService],
  exports: [AdbService],
})
export class AdbModule {}
