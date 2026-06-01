import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import { AdbService, ViewerCommand } from "./adb.service";
import {
  AdbClipboardDto,
  AdbClipboardResultDto,
  AdbControlDto,
  AdbControlResultDto,
  AdbLogcatDto,
  AdbNotificationsDto,
  AdbScreenshotDto,
} from "./adb.dto";

const viewerCommands = new Set<ViewerCommand>([
  "back",
  "home",
  "recents",
  "power",
  "wake",
  "sleep",
  "volume-up",
  "volume-down",
  "mute",
  "rotate",
  "expand-notifications",
  "expand-settings",
  "collapse-panels",
]);

const clampTail = (value: string | undefined) => {
  const parsed = Number(value ?? 300);
  if (!Number.isFinite(parsed)) {
    return 300;
  }

  return Math.max(1, Math.min(Math.trunc(parsed), 2000));
};

@UseGuards(SidecarAuthGuard)
@Controller("rebroid/adb/:udid")
@ApiTags("adb")
@ApiHeader({
  name: "x-rebroid-sidecar-secret",
  required: false,
  description: "Required when sidecar shared-secret auth is configured.",
})
@ApiParam({
  name: "udid",
  description: "ADB serial or host:port target reachable from the sidecar.",
})
export class AdbController {
  constructor(private readonly adb: AdbService) {}

  @Post("control")
  @ApiOperation({ summary: "Execute a legacy ADB viewer control command." })
  @ApiBody({ type: AdbControlDto })
  @ApiOkResponse({ type: AdbControlResultDto })
  async control(@Param("udid") udid: string, @Body() body: AdbControlDto) {
    if (!body.command || !viewerCommands.has(body.command as ViewerCommand)) {
      return {
        command: body.command ?? null,
        executed: false,
        message: `Unsupported ADB control command: ${body.command ?? "missing"}`,
      };
    }

    const command = body.command as ViewerCommand;
    const result = await this.adb.viewerAction(udid, command);
    return {
      command,
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  @Get("clipboard")
  @ApiOperation({ summary: "Read Android clipboard text through ADB." })
  @ApiOkResponse({ type: AdbClipboardResultDto })
  getClipboard(@Param("udid") udid: string) {
    return this.adb.getClipboard(udid);
  }

  @Put("clipboard")
  @ApiOperation({ summary: "Set Android clipboard text through ADB." })
  @ApiBody({ type: AdbClipboardDto })
  @ApiOkResponse({ type: AdbClipboardResultDto })
  setClipboard(@Param("udid") udid: string, @Body() body: AdbClipboardDto) {
    return this.adb.setClipboard(udid, body.text ?? "");
  }

  @Get("logcat")
  @ApiOperation({ summary: "Read recent Android logcat output through ADB." })
  @ApiQuery({ name: "tail", required: false, example: 300 })
  @ApiOkResponse({ type: AdbLogcatDto })
  async logcat(@Param("udid") udid: string, @Query("tail") tail?: string) {
    const result = await this.adb.logcat(udid, clampTail(tail));
    return {
      source: "adb" as const,
      collectedAt: new Date().toISOString(),
      output: result.stdout,
    };
  }

  @Get("notifications")
  @ApiOperation({ summary: "Read Android notification dump through ADB." })
  @ApiOkResponse({ type: AdbNotificationsDto })
  async notifications(@Param("udid") udid: string) {
    const result = await this.adb.notifications(udid);
    return {
      output: result.stdout,
    };
  }

  @Get("screenshot")
  @ApiOperation({ summary: "Capture a PNG screenshot through ADB." })
  @ApiOkResponse({ type: AdbScreenshotDto })
  async screenshot(@Param("udid") udid: string) {
    const image = await this.adb.screencapPng(udid);
    return {
      mimeType: "image/png",
      dataUrl: `data:image/png;base64,${image.toString("base64")}`,
      capturedAt: new Date().toISOString(),
    };
  }
}
