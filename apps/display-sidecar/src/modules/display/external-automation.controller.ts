import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { viewerCommands } from "@rebroid/android-application-core/viewer-control";
import type { FastifyReply } from "fastify";
import { z } from "zod";
import { AdbService } from "../adb/adb.service";
import { runAttachmentRequest } from "../external-adb/attachment-request-signal";
import { ExternalAdbAttachments } from "../external-adb/external-adb-attachments";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import { SidecarConfigService } from "../shared/sidecar-config.service";

const coordinate = z.number().int().min(0).max(16384);
const automationOperation = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("tap"), x: coordinate, y: coordinate }),
  z.strictObject({
    operation: z.literal("swipe"),
    x1: coordinate,
    y1: coordinate,
    x2: coordinate,
    y2: coordinate,
    durationMs: z.number().int().min(0).max(5000),
  }),
  z.strictObject({
    operation: z.enum(["text", "writeClipboard"]),
    text: z.string().max(64 * 1024),
  }),
  z.strictObject({
    operation: z.literal("key"),
    key: z.string().regex(/^[A-Za-z0-9_]{1,80}$/),
  }),
  z.strictObject({
    operation: z.literal("launch"),
    packageName: z
      .string()
      .max(200)
      .regex(/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/),
  }),
  z.strictObject({
    operation: z.literal("viewer"),
    command: z.enum(viewerCommands).exclude(["rotate"]),
  }),
  z.strictObject({ operation: z.enum(["readClipboard", "dumpUi"]) }),
]);

@ApiTags("external-adb")
@ApiSecurity("sidecar-secret")
@UseGuards(SidecarAuthGuard)
@Controller(
  "rebroid/external-adb/devices/:id/attachments/:attachmentId/automation",
)
export class ExternalAutomationController {
  constructor(
    private readonly attachments: ExternalAdbAttachments,
    private readonly adb: AdbService,
    private readonly config: SidecarConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: "Execute a typed operation on an external attachment.",
  })
  execute(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!this.config.externalAdbEnabled || !this.config.hasSharedSecret)
      throw new NotFoundException();
    const target = this.attachments.requireVerified(attachmentId, id);
    const input = automationOperation.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Unsupported external Android operation.");
    return runAttachmentRequest(reply.raw, target.signal, (signal) =>
      this.dispatch(attachmentId, input.data, signal),
    );
  }

  private async dispatch(
    id: string,
    operation: z.infer<typeof automationOperation>,
    signal: AbortSignal,
  ) {
    switch (operation.operation) {
      case "readClipboard":
        return this.adb.getClipboard(id);
      case "writeClipboard":
        return this.adb.setClipboard(id, operation.text);
      case "dumpUi": {
        const result = await this.adb.dumpUi(id, signal);
        return result.status === "available"
          ? { status: result.status, xml: result.xml }
          : { status: result.status };
      }
      case "launch": {
        const installed = await this.adb.shellResult(
          id,
          ["pm", "path", operation.packageName],
          2_500,
          signal,
        );
        if (installed.exitCode !== 0 || !installed.stdout.includes("package:"))
          return { installed: false, launched: false };
        const launched = await this.adb.shellResult(
          id,
          [
            "monkey",
            "-p",
            operation.packageName,
            "-c",
            "android.intent.category.LAUNCHER",
            "1",
          ],
          4_000,
          signal,
        );
        return {
          installed: true,
          launched:
            launched.exitCode === 0 &&
            /Events injected:\s*1\b/.test(launched.stdout),
        };
      }
      case "tap":
        await this.adb.tap(id, operation.x, operation.y, signal);
        break;
      case "swipe":
        await this.adb.swipe(id, operation);
        break;
      case "text":
        await this.adb.inputText(id, operation.text, signal);
        break;
      case "key":
        await this.adb.keyEvent(id, operation.key);
        break;
      case "viewer":
        await this.adb.viewerAction(id, operation.command);
        break;
    }
    return { executed: true };
  }
}
