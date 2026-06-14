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
  Req,
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
import type { FastifyReply } from "fastify";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { AdbService } from "../adb/adb.service";
import type { ViewerCommand } from "@rebroid/application-core/viewer-control";
import { VIEWER_CONTROL_COMMANDS } from "../scrcpy/scrcpy-control-codec";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import {
  CreateDisplaySessionDto,
  CreateDisplaySurfaceDto,
  DisplayActionDto,
  DisplayCapabilitiesDto,
  DisplayClipboardDto,
  DisplayClipboardResultDto,
  DisplayCommandResultDto,
  DisplayHealthDto,
  DisplayKeyboardDto,
  DisplayLogcatDto,
  DisplayRecordingListResponseDto,
  DisplayRecordingResponseDto,
  DisplaySessionDto,
  DisplaySessionListResponseDto,
  DisplaySessionResponseDto,
  DisplaySurfaceListResponseDto,
  DisplayTouchDto,
  DisplayWebrtcAnswerDto,
  DisplayWebrtcOfferDto,
  PublicDisplayActionDto,
} from "./display.dto";
import { viewerCommands } from "@rebroid/application-core/viewer-control";
import { DisplaySessionService } from "./display-session.service";
import { DisplayWebrtcService } from "./display-webrtc.service";

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
    private readonly webrtc: DisplayWebrtcService,
  ) {}

  @Get("viewer/display")
  @ApiExcludeEndpoint()
  async viewer(@Res() response: FastifyReply) {
    await this.sendViewerFile(
      response,
      VIEWER_DISPLAY_HTML_PATH,
      "text/html; charset=utf-8",
      500,
      "The live display viewer is not available.",
    );
  }

  @Get("viewer/display/assets/:file")
  @ApiExcludeEndpoint()
  async viewerAsset(
    @Param("file") file: string,
    @Res() response: FastifyReply,
  ) {
    const safeFile = basename(file);
    const contentType = VIEWER_ASSET_TYPES[extname(safeFile)];
    if (!contentType || safeFile !== file) {
      response.status(404).send("Not found.");
      return;
    }

    await this.sendViewerFile(
      response,
      join(VIEWER_DISPLAY_DIR, "assets", safeFile),
      contentType,
      404,
      "Not found.",
    );
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
        protocols: ["websocket", "webrtc"],
        adapters: ["scrcpy-server-v4-raw"],
        codecs: ["h264"],
        audioCodecs: ["opus"],
        defaultCodec: "h264",
        players: ["webcodecs", "webrtc"],
      },
      compatibility: {
        scrcpyVersion: this.scrcpy.serverVersion(),
        supportedAndroidVersions: ["13", "14"],
        unsupportedAndroidVersions: ["15", "16"],
        fallbackModes: [
          "audio-disabled",
          "stream-control-disabled",
          "stable-video",
        ],
      },
      surfaces: {
        defaultSurface: "main",
        virtualDisplayLimit: 1,
        virtualDisplayDefault: "1280x720/160",
      },
      recording: {
        container: "mp4",
        videoCodec: "h264",
        audio: "not-recorded",
      },
      actions: viewerCommands,
      adbOwnedBySidecar: true,
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions")
  @ApiOperation({
    summary:
      "Create or reuse a token-scoped display session for an ADB target.",
  })
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
  @ApiOperation({
    summary: "List display sessions known to this sidecar instance.",
  })
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
  @Get("rebroid/display/sessions/:id/surfaces")
  @ApiOperation({ summary: "List display surfaces for one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySurfaceListResponseDto })
  listSessionSurfaces(@Param("id") id: string) {
    return { items: this.sessions.getPublic(id).surfaces };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/surfaces")
  @ApiOperation({
    summary: "Create or reuse one experimental virtual display surface.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Parent display session id." })
  @ApiBody({ type: CreateDisplaySurfaceDto })
  @ApiOkResponse({ type: DisplaySessionResponseDto })
  createSessionSurface(
    @Param("id") id: string,
    @Body() body: CreateDisplaySurfaceDto,
  ) {
    return { session: this.sessions.createVirtualSurface(id, body) };
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/:id/surfaces/:surfaceId")
  @ApiOperation({ summary: "Release one virtual display surface." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Parent display session id." })
  @ApiParam({ name: "surfaceId", description: "Display surface id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  releaseSessionSurface(
    @Param("id") id: string,
    @Param("surfaceId") surfaceId: string,
  ) {
    const session = this.sessions.releaseSurface(id, surfaceId);
    try {
      this.webrtc.stopSession(session.id);
    } catch {
      // Surface release already succeeded. Cleanup is best-effort.
    }
    try {
      this.scrcpy.closeSession(session.id);
    } catch {
      // Surface release already succeeded. Cleanup is best-effort.
    }
    return session;
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/apps/:appId")
  @ApiOperation({ summary: "Release every display session for one app." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "appId", description: "Application id." })
  @ApiOkResponse({ type: DisplaySessionListResponseDto })
  releaseAppSessions(@Param("appId") appId: string) {
    const items = this.sessions.releaseForApp(appId);
    for (const session of items) {
      this.webrtc.stopSession(session.id);
      this.scrcpy.closeSession(session.id);
    }
    return { items };
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/:id")
  @ApiOperation({ summary: "Release one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplaySessionDto })
  releaseSession(@Param("id") id: string) {
    const session = this.sessions.release(id);
    this.webrtc.stopSession(id);
    this.scrcpy.closeSession(id);
    return session;
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id/recordings")
  @ApiOperation({ summary: "List recordings for one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplayRecordingListResponseDto })
  listRecordings(@Param("id") id: string) {
    this.sessions.get(id);
    return { items: this.scrcpy.listRecordings(id) };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/recording/start")
  @ApiOperation({ summary: "Start recording one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplayRecordingResponseDto })
  startRecording(@Param("id") id: string) {
    const session = this.sessions.get(id);
    return {
      recording: this.scrcpy.startRecording(id, session.displayName),
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/recording/stop")
  @ApiOperation({ summary: "Stop recording one display session." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiOkResponse({ type: DisplayRecordingResponseDto })
  stopRecording(@Param("id") id: string) {
    this.sessions.get(id);
    return { recording: this.scrcpy.stopRecording(id) };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/recordings/:recordingId")
  @ApiOperation({ summary: "Download a completed display recording." })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "recordingId", description: "Display recording id." })
  async downloadRecording(
    @Param("recordingId") recordingId: string,
    @Res() response: FastifyReply,
  ) {
    const recording = this.scrcpy.getRecording(recordingId);
    if (!recording) {
      response.status(404).send("Recording not found.");
      return;
    }

    response
      .type(recording.mimeType)
      .header(
        "content-disposition",
        `attachment; filename="${recording.fileName.replace(/"/g, "")}"`,
      )
      .send(recording.data);
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

    if (this.scrcpy.shouldWaitForStreamControl(id)) {
      throw new ConflictException(
        "Live controls are reconnecting. Try again in a moment.",
      );
    }

    return this.adb.setClipboard(session.udid, body.text ?? "");
  }

  @UseGuards(SidecarAuthGuard)
  @Post("rebroid/display/sessions/:id/actions")
  @ApiOperation({
    summary: "Execute a viewer control action for a display session.",
  })
  @ApiHeader({ name: "x-rebroid-sidecar-secret", required: false })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async action(@Param("id") id: string, @Body() body: DisplayActionDto) {
    const session = this.sessions.get(id);
    return this.executeViewerAction(id, session.udid, body);
  }

  @Post("rebroid/display/public/sessions/:id/actions")
  @ApiOperation({
    summary: "Execute a viewer control action using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: PublicDisplayActionDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async publicAction(
    @Param("id") id: string,
    @Body() body: PublicDisplayActionDto,
  ) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    this.sessions.assertCapability(session, "control");
    return this.executeViewerAction(id, session.udid, body);
  }

  @Post("rebroid/display/public/sessions/:id/webrtc/offer")
  @ApiOperation({
    summary: "Create a WebRTC display answer using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayWebrtcOfferDto })
  @ApiOkResponse({ type: DisplayWebrtcAnswerDto })
  async publicWebrtcOffer(
    @Param("id") id: string,
    @Body() body: DisplayWebrtcOfferDto,
    @Req() request: { headers: Record<string, string | string[] | undefined> },
  ) {
    return this.webrtc.createAnswer({
      sessionId: id,
      token: body.token ?? null,
      sdp: body.sdp,
      requestHost: this.firstHeader(
        request.headers["x-rebroid-viewer-host"] ??
          request.headers["x-forwarded-host"] ??
          request.headers.host,
      ),
      bitrate: body.bitrate,
      maxFps: body.maxFps,
      maxSize: body.maxSize,
      iFrameInterval: body.iFrameInterval,
      audio: body.audio === true,
    });
  }

  @Post("rebroid/display/public/sessions/:id/keyboard")
  @ApiOperation({
    summary: "Send a browser keyboard event using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayKeyboardDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async publicKeyboard(
    @Param("id") id: string,
    @Body() body: DisplayKeyboardDto,
  ) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    this.sessions.assertCapability(session, "control");
    const handledByStream = this.scrcpy.sendKeyboardEvent(id, body);
    if (handledByStream) {
      return {
        ok: true,
        executed: true,
        transport: "stream-control",
      };
    }

    if (this.scrcpy.shouldWaitForStreamControl(id)) {
      throw new ConflictException(
        "Live controls are reconnecting. Try again in a moment.",
      );
    }

    const result = await this.adb.keyboardEvent(session.udid, body);
    return {
      ok: true,
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  @Post("rebroid/display/public/sessions/:id/touch")
  @ApiOperation({
    summary: "Send a tap or swipe event using a display session token.",
  })
  @ApiParam({ name: "id", description: "Display session id." })
  @ApiBody({ type: DisplayTouchDto })
  @ApiOkResponse({ type: DisplayCommandResultDto })
  async publicTouch(@Param("id") id: string, @Body() body: DisplayTouchDto) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    this.sessions.assertCapability(session, "control");
    const handledByStream = this.scrcpy.sendTouchEvent(id, body);
    if (handledByStream) {
      return {
        ok: true,
        executed: true,
        transport: "stream-control",
      };
    }

    if (this.scrcpy.shouldWaitForStreamControl(id)) {
      throw new ConflictException(
        "Live controls are reconnecting. Try again in a moment.",
      );
    }

    const result = await this.adb.touchEvent(session.udid, body);
    return {
      ok: true,
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id/logcat")
  @ApiOperation({
    summary: "Read recent Android logcat output for a display session.",
  })
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
    const command = body.command;
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
        command: viewerCommand,
        executed: true,
        transport: "stream-control",
      };
    }

    if (this.scrcpy.shouldWaitForStreamControl(id)) {
      throw new ConflictException(
        "Live controls are reconnecting. Try again in a moment.",
      );
    }

    const result = await this.adb.viewerAction(udid, viewerCommand);
    return {
      ok: true,
      command: viewerCommand,
      executed: true,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  private async sendViewerFile(
    response: FastifyReply,
    filePath: string,
    contentType: string,
    errorStatus: number,
    errorMessage: string,
  ) {
    try {
      await access(filePath);
    } catch {
      response.status(errorStatus).send(errorMessage);
      return;
    }

    response.type(contentType).send(createReadStream(filePath));
  }

  private firstHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }
}
