import {
  Body,
  Controller,
  Delete,
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
import { AdbService } from "./adb.service";
import {
  AdbClipboardDto,
  AdbClipboardResultDto,
  AdbFileDto,
  AdbFileExistsResultDto,
  AdbInputTextDto,
  AdbKeyDto,
  AdbListFilesResultDto,
  AdbLogcatDto,
  AdbNotificationsDto,
  AdbPullFileResultDto,
  AdbPushFileDto,
  AdbRotateDisplayDto,
  AdbScreenshotDto,
  AdbShellDto,
  AdbShellResultDto,
  AdbSwipeDto,
  AdbTapDto,
  AdbTapTextDto,
  AdbTapTextResultDto,
  AdbUiDumpDto,
} from "./adb.dto";

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

  @Post("tap")
  @ApiBody({ type: AdbTapDto })
  @ApiOkResponse({ type: Object })
  async tap(@Param("udid") udid: string, @Body() body: AdbTapDto) {
    await this.adb.tap(udid, Number(body.x), Number(body.y));
    return { executed: true };
  }

  @Post("swipe")
  @ApiBody({ type: AdbSwipeDto })
  @ApiOkResponse({ type: Object })
  async swipe(@Param("udid") udid: string, @Body() body: AdbSwipeDto) {
    await this.adb.swipe(udid, body);
    return { executed: true };
  }

  @Post("input-text")
  @ApiBody({ type: AdbInputTextDto })
  @ApiOkResponse({ type: Object })
  async inputText(@Param("udid") udid: string, @Body() body: AdbInputTextDto) {
    await this.adb.inputText(udid, body.text ?? "");
    return { executed: true };
  }

  @Post("key")
  @ApiBody({ type: AdbKeyDto })
  @ApiOkResponse({ type: Object })
  async key(@Param("udid") udid: string, @Body() body: AdbKeyDto) {
    await this.adb.keyEvent(udid, body.key ?? "");
    return { executed: true };
  }

  @Post("rotate-display")
  @ApiBody({ type: AdbRotateDisplayDto })
  @ApiOkResponse({ type: Object })
  async rotateDisplay(
    @Param("udid") udid: string,
    @Body() body: AdbRotateDisplayDto,
  ) {
    await this.adb.rotateDisplayTo(udid, body.orientation);
    return { executed: true };
  }

  @Post("shell")
  @ApiBody({ type: AdbShellDto })
  @ApiOkResponse({ type: AdbShellResultDto })
  shell(@Param("udid") udid: string, @Body() body: AdbShellDto) {
    return this.adb.shellCommand(
      udid,
      body.command ?? "",
      Math.max(100, Math.min(Number(body.timeoutMs ?? 15_000), 120_000)),
    );
  }

  @Get("ui-dump")
  @ApiOkResponse({ type: AdbUiDumpDto })
  async uiDump(@Param("udid") udid: string) {
    return {
      ...(await this.adb.dumpUi(udid)),
      dumpedAt: new Date().toISOString(),
    };
  }

  @Post("tap-text")
  @ApiBody({ type: AdbTapTextDto })
  @ApiOkResponse({ type: AdbTapTextResultDto })
  tapText(@Param("udid") udid: string, @Body() body: AdbTapTextDto) {
    return this.adb.tapText(udid, body.text ?? "");
  }

  @Put("files")
  @ApiBody({ type: AdbPushFileDto })
  @ApiOkResponse({ type: Object })
  async pushFile(@Param("udid") udid: string, @Body() body: AdbPushFileDto) {
    await this.adb.pushFileContent(udid, body.path, body.contentBase64 ?? "");
    return { pushed: true };
  }

  @Get("files")
  @ApiQuery({ name: "path", required: true })
  @ApiOkResponse({ type: AdbPullFileResultDto })
  pullFile(@Param("udid") udid: string, @Query("path") path: string) {
    return this.adb.pullFileContent(udid, path);
  }

  @Delete("files")
  @ApiBody({ type: AdbFileDto })
  @ApiOkResponse({ type: Object })
  async deleteFile(@Param("udid") udid: string, @Body() body: AdbFileDto) {
    await this.adb.deleteFile(udid, body.path);
    return { deleted: true };
  }

  @Get("files/exists")
  @ApiQuery({ name: "path", required: true })
  @ApiOkResponse({ type: AdbFileExistsResultDto })
  async fileExists(@Param("udid") udid: string, @Query("path") path: string) {
    return { exists: await this.adb.fileExists(udid, path) };
  }

  @Get("files/list")
  @ApiQuery({ name: "path", required: true })
  @ApiOkResponse({ type: AdbListFilesResultDto })
  async listFiles(@Param("udid") udid: string, @Query("path") path: string) {
    return { files: await this.adb.listFiles(udid, path) };
  }
}
