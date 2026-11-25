import { Module } from "@nestjs/common";
import { ExternalAdbAttachments } from "./external-adb-attachments";
import { ExternalAdbController } from "./external-adb.controller";
import { ExternalAdbDaemon } from "./external-adb-daemon";

@Module({
  controllers: [ExternalAdbController],
  providers: [ExternalAdbAttachments, ExternalAdbDaemon],
  exports: [ExternalAdbAttachments, ExternalAdbDaemon],
})
export class ExternalAdbModule {}
