import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import type { ViewerCommand } from "@rebroid/android-application-core/viewer-control";
import { AdbService } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { VIEWER_CONTROL_COMMANDS } from "../scrcpy/scrcpy-control-codec";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayControlRequest } from "./display.types";

@Injectable()
export class DisplayControlService {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  async execute(sessionId: string, request: DisplayControlRequest) {
    const session = this.sessions.get(sessionId);
    this.sessions.assertCapability(
      session,
      request.type === "clipboard" ? "clipboard" : "control",
    );

    try {
      const result = await this.route(sessionId, session.udid, request);
      this.sessions.touch(sessionId);
      return result;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new InternalServerErrorException({
        statusCode: 500,
        code: "execution_failed",
        message: "The display control could not be executed.",
      });
    }
  }

  private route(
    sessionId: string,
    udid: string,
    request: DisplayControlRequest,
  ) {
    if (request.type === "action") {
      if (
        !request.command ||
        !VIEWER_CONTROL_COMMANDS.has(request.command as ViewerCommand)
      ) {
        throw new BadRequestException({
          statusCode: 400,
          code: "invalid_control",
          message: "The display action is invalid.",
        });
      }
      const command = request.command as ViewerCommand;
      return this.withFallback(
        sessionId,
        this.scrcpy.sendViewerAction(sessionId, command),
        () => this.adb.viewerAction(udid, command),
        command,
      );
    }
    if (request.type === "keyboard") {
      return this.withFallback(
        sessionId,
        this.scrcpy.sendKeyboardEvent(sessionId, request),
        () => this.adb.keyboardEvent(udid, request),
      );
    }
    if (request.type === "touch") {
      return this.withFallback(
        sessionId,
        this.scrcpy.sendTouchEvent(sessionId, request),
        () => this.adb.touchEvent(udid, request),
      );
    }
    return this.withFallback(
      sessionId,
      this.scrcpy.sendClipboard(sessionId, request.text ?? ""),
      () => this.adb.setClipboard(udid, request.text ?? ""),
    );
  }

  private async withFallback(
    sessionId: string,
    handledByStream: boolean,
    executeAdb: () => Promise<unknown>,
    command?: ViewerCommand,
  ) {
    if (handledByStream) {
      return { command, executed: true, transport: "stream-control" as const };
    }
    if (this.scrcpy.shouldWaitForStreamControl(sessionId)) {
      throw new ConflictException({
        statusCode: 409,
        code: "control_reconnecting",
        message: "Live controls are reconnecting. Try again in a moment.",
      });
    }
    await executeAdb();
    return { command, executed: true, transport: "adb" as const };
  }
}
