import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiExcludeEndpoint,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { createReadStream } from "node:fs";
import { basename, extname, join } from "node:path";
import { AdbService, ViewerCommand } from "../adb/adb.service";
import { VIEWER_CONTROL_COMMANDS } from "../scrcpy/scrcpy-control-codec";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import {
  CreateDisplaySessionDto,
  DisplayActionDto,
  DisplayCapabilitiesDto,
  DisplayClipboardDto,
  DisplayClipboardResultDto,
  DisplayCommandResultDto,
  DisplayHealthDto,
  DisplayKeyboardDto,
  DisplayLogcatDto,
  DisplaySessionDto,
  DisplaySessionListResponseDto,
  DisplaySessionResponseDto,
  DisplayTouchDto,
  PublicDisplayActionDto,
} from "./display.dto";
import { DisplaySessionService } from "./display-session.service";

const VIEWER_DISPLAY_DIR = join(__dirname, "viewer");
const VIEWER_DISPLAY_HTML_PATH = join(VIEWER_DISPLAY_DIR, "index.html");
const VIEWER_ASSET_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

@Controller()
@ApiTags("display")
export class DisplayController {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  @Get("viewer/display")
  @ApiExcludeEndpoint()
  viewer(@Res() response: Response) {
    response.type("html");
    const stream = createReadStream(VIEWER_DISPLAY_HTML_PATH);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.status(500).send("The live display viewer is not available.");
        return;
      }

      response.end();
    });
    stream.pipe(response);
  }

  @Get("viewer/display/assets/:file")
  @ApiExcludeEndpoint()
  viewerAsset(@Param("file") file: string, @Res() response: Response) {
    const safeFile = basename(file);
    const contentType = VIEWER_ASSET_TYPES[extname(safeFile)];
    if (!contentType || safeFile !== file) {
      response.status(404).send("Not found.");
      return;
    }

    response.type(contentType);
    const stream = createReadStream(join(VIEWER_DISPLAY_DIR, "assets", safeFile));
    stream.on("error", () => {
      if (!response.headersSent) {
        response.status(404).send("Not found.");
        return;
      }

      response.end();
    });
    stream.pipe(response);
  }

  @Get("rebroid/display/health")
  @ApiOperation({ summary: "Read display service health." })
  @ApiOkResponse({ type: DisplayHealthDto })
  health() {
    return { ok: true, service: "rebroid-display" };
  }

  @Get("rebroid/display/capabilities")
  @ApiOperation({ summary: "Read display stream and control capabilities." })
  @ApiOkResponse({ type: DisplayCapabilitiesDto })
  capabilities() {
    return {
      stream: {
        protocols: ["websocket"],
        adapters: ["scrcpy-server-v4-raw"],
        codecs: ["h264"],
        defaultCodec: "h264",
        players: ["webcodecs"],
      },
      actions: [
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
      ],
      adbOwnedBySidecar: true,
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions")
  @ApiOperation({ summary: "Create or reuse a token-scoped display session for an ADB target." })
  @ApiHeader({
    name: "x-rebroid-sidecar-secret",
    required: false,
    description: "Required when sidecar shared-secret auth is configured.",
  })
  @ApiBody({ type: CreateDisplaySessionDto })
  @ApiOkResponse({ type: DisplaySessionResponseDto })
  async createSession(@Body() body: CreateDisplaySessionDto) {
    await this.adb.ensureConnected(body.udid);
    return {
      session: this.sessions.create(body),
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions")
  @ApiOperation({ summary: "List display sessions known to this sidecar instance." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiOkResponse({ type: DisplaySessionListResponseDto })
  listSessions() {
    return { items: this.sessions.list() };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id")
  @ApiOperation({ summary: "Read one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  getSession(@Param("id") id: string) {
    return this.sessions.getPublic(id);
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/:id")
  @ApiOperation({ summary: "Release one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  releaseSession(@Param("id") id: string) {
    return this.sessions.release(id);
  }

  @UseGuards(SidecarAuthGuard)
  @Put("rebroid/display/sessions/:id/clipboard")
  @ApiOperation({ summary: "Set Android clipboard for a display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayClipboardDto })
  @ApiOkResponse({ type: DisplayClipboardResultDto })
  setClipboard(@Param("id") id: string, @Body() body: DisplayClipboardDto) {
    const session = this.sessions.get(id);
    const handledByStream = this.scrcpy.sendClipboard(id, body.text ?? "");
    if (handledByStream) {
      this.sessions.touch(id);
      return {
        text: body.text ?? "",
        supported: true,
        session: this.sessions.getPublic(id),
        transport: "stream-control",
      };
    }

    if (this.scrcpy.isStreamingSession(id) && this.scrcpy.usesStreamControl()) {
      throw new ConflictException("Live controls are reconnecting. Try again in a moment.");
    }

    return this.adb.setClipboard(session.udid, body.text ?? "");
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/actions")
  @ApiOperation({ summary: "Execute a viewer control action for a display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async action(@Param("id") id: string, @Body() body: DisplayActionDto) {
    const session = this.sessions.get(id);
    return this.executeViewerAction(id, session.udid, body);
  }

  @Post("rebroid/display/public/sessions/:id/actions")
  @ApiOperation({ summary: "Execute a viewer control action using a display session token." })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: PublicDisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async publicAction(
    @Param("id") id: string,
    @Body() body: PublicDisplayActionDto,
  ) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    return this.executeViewerAction(id, session.udid, body);
  }

  @Post("rebroid/display/public/sessions/:id/keyboard")
  @ApiOperation({ summary: "Send a browser keyboard event using a display session token." })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayKeyboardDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async publicKeyboard(
    @Param("id") id: string,
    @Body() body: DisplayKeyboardDto,
  ) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    const handledByStream = this.scrcpy.sendKeyboardEvent(id, body);
    if (handledByStream) {
      return {
        ok: true,
        session: this.sessions.getPublic(id),
        executed: true,
        transport: "stream-control",
      };
    }

    if (this.scrcpy.isStreamingSession(id) && this.scrcpy.usesStreamControl()) {
      throw new ConflictException("Live controls are reconnecting. Try again in a moment.");
    }

    const result = await this.adb.keyboardEvent(session.udid, body);
    return {
      ok: true,
      session: this.sessions.getPublic(id),
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  @Post("rebroid/display/public/sessions/:id/touch")
  @ApiOperation({ summary: "Send a tap or swipe event using a display session token." })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayTouchDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async publicTouch(
    @Param("id") id: string,
    @Body() body: DisplayTouchDto,
  ) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    const handledByStream = this.scrcpy.sendTouchEvent(id, body);
    if (handledByStream) {
      return {
        ok: true,
        session: this.sessions.getPublic(id),
        executed: true,
        transport: "stream-control",
      };
    }

    if (this.scrcpy.isStreamingSession(id) && this.scrcpy.usesStreamControl()) {
      throw new ConflictException("Live controls are reconnecting. Try again in a moment.");
    }

    const result = await this.adb.touchEvent(session.udid, body);
    return {
      ok: true,
      session: this.sessions.getPublic(id),
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id/logcat")
  @ApiOperation({ summary: "Read recent Android logcat output for a display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiQuery({ name: "tail", required: false, example: 300 })
  @ApiOkResponse({ type: DisplayLogcatDto })
  async logcat(@Param("id") id: string, @Query("tail") tail?: string) {
    const session = this.sessions.get(id);
    const result = await this.adb.logcat(session.udid, Number(tail ?? 300));
    return {
      collectedAt: new Date().toISOString(),
      output: result.stdout,
    };
  }

  private async executeViewerAction(
    id: string,
    udid: string,
    body: DisplayActionDto,
  ) {
    const command = body.command ?? body.action;
    if (!command) {
      return {
        ok: false,
        message: "Missing display action command.",
      };
    }

    if (!VIEWER_CONTROL_COMMANDS.has(command as ViewerCommand)) {
      return {
        ok: false,
        message: `Unsupported display action command: ${command}`,
      };
    }

    const viewerCommand = command as ViewerCommand;
    const handledByStream = this.scrcpy.sendViewerAction(id, viewerCommand);
    if (handledByStream) {
      return {
        ok: true,
        session: this.sessions.getPublic(id),
        action: viewerCommand,
        command: viewerCommand,
        executed: true,
        transport: "stream-control",
      };
    }

    if (this.scrcpy.isStreamingSession(id) && this.scrcpy.usesStreamControl()) {
      throw new ConflictException("Live controls are reconnecting. Try again in a moment.");
    }

    const result = await this.adb.viewerAction(udid, viewerCommand);
    return {
      ok: true,
      session: this.sessions.getPublic(id),
      action: viewerCommand,
      command: viewerCommand,
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
}
