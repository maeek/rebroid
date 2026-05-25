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
import { Response } from "express";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { AdbService, ViewerCommand } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { SidecarAuthGuard } from "../shared/sidecar-auth.guard";
import {
  CreateDisplaySessionBody,
  DisplayClipboardBody,
  DisplayActionBody,
  DisplayKeyboardBody,
  DisplayTouchBody,
  PublicDisplayActionBody,
} from "./display.types";
import { DisplaySessionService } from "./display-session.service";

const VIEWER_DISPLAY_HTML_PATH = join(__dirname, "display-viewer.html");

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

@Controller()
export class DisplayController {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  @Get("viewer/display")
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

  @Get("rebroid/display/health")
  health() {
    return { ok: true, service: "rebroid-display" };
  }

  @Get("rebroid/display/capabilities")
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
  async createSession(@Body() body: CreateDisplaySessionBody) {
    await this.adb.ensureConnected(body.udid);
    return {
      session: this.sessions.create(body),
    };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions")
  listSessions() {
    return { items: this.sessions.list() };
  }

  @UseGuards(SidecarAuthGuard)
  @Get("rebroid/display/sessions/:id")
  getSession(@Param("id") id: string) {
    return this.sessions.getPublic(id);
  }

  @UseGuards(SidecarAuthGuard)
  @Delete("rebroid/display/sessions/:id")
  releaseSession(@Param("id") id: string) {
    return this.sessions.release(id);
  }

  @UseGuards(SidecarAuthGuard)
  @Put("rebroid/display/sessions/:id/clipboard")
  setClipboard(@Param("id") id: string, @Body() body: DisplayClipboardBody) {
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
  async action(@Param("id") id: string, @Body() body: DisplayActionBody) {
    const session = this.sessions.get(id);
    return this.executeViewerAction(id, session.udid, body);
  }

  @Post("rebroid/display/public/sessions/:id/actions")
  async publicAction(
    @Param("id") id: string,
    @Body() body: PublicDisplayActionBody,
  ) {
    const session = this.sessions.assertStreamToken(id, body.token ?? null);
    return this.executeViewerAction(id, session.udid, body);
  }

  @Post("rebroid/display/public/sessions/:id/keyboard")
  async publicKeyboard(
    @Param("id") id: string,
    @Body() body: DisplayKeyboardBody,
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
  async publicTouch(
    @Param("id") id: string,
    @Body() body: DisplayTouchBody,
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
    body: DisplayActionBody,
  ) {
    const command = body.command ?? body.action;
    if (!command) {
      return {
        ok: false,
        message: "Missing display action command.",
      };
    }

    if (!viewerCommands.has(command as ViewerCommand)) {
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
