import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOkResponse,
  ApiProperty,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import { AdbService } from "../adb/adb.service";
import { runAttachmentRequest } from "../external-adb/attachment-request-signal";
import { ExternalAdbAttachments } from "../external-adb/external-adb-attachments";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplayLogcatDto } from "./display.dto";

class ExternalScreenshotDto {
  @ApiProperty()
  pngBase64!: string;
}

@ApiTags("external-adb")
@ApiSecurity("sidecar-secret")
@UseGuards(SidecarAuthGuard)
@Controller("rebroid/external-adb/devices/:id/attachments/:attachmentId")
export class ExternalDisplayToolsController {
  constructor(
    private readonly attachments: ExternalAdbAttachments,
    private readonly adb: AdbService,
    private readonly config: SidecarConfigService,
  ) {}

  @Get("screenshot")
  @ApiOkResponse({ type: ExternalScreenshotDto })
  async screenshot(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const target = this.requireAttachment(id, attachmentId);
    const png = await runAttachmentRequest(reply.raw, target.signal, () =>
      this.adb.screencapPng(attachmentId),
    );
    if (
      png.length > 12 * 1024 * 1024 ||
      png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    ) {
      throw new ConflictException("The screenshot is unavailable.");
    }
    return { pngBase64: png.toString("base64") };
  }

  @Get("logcat")
  @ApiOkResponse({ type: DisplayLogcatDto })
  async logcat(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
  ) {
    const target = this.requireAttachment(id, attachmentId);
    const { stdout } = await this.adb.logcat(attachmentId, 300, {
      timeoutMs: 5_000,
      signal: target.signal,
      maxOutputBytes: 256 * 1024,
    });
    target.signal.throwIfAborted();
    return { collectedAt: new Date().toISOString(), output: stdout };
  }

  private requireAttachment(id: string, attachmentId: string) {
    if (!this.config.externalAdbEnabled || !this.config.hasSharedSecret)
      throw new NotFoundException();
    return this.attachments.requireVerified(attachmentId, id);
  }
}
