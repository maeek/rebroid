import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { ViewerCommand } from "@rebroid/android-application-core/viewer-control";
import { AdbService } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { VIEWER_CONTROL_COMMANDS } from "../scrcpy/scrcpy-control-codec";
import { ScrcpyControlDispatchError } from "../scrcpy/scrcpy-control-dispatch-error";
import { DisplaySessionService } from "./display-session.service";
import { validateDisplayControl } from "./display-control-validation";
import type { DisplayControlRequest, DisplaySession } from "./display.types";

@Injectable()
export class DisplayControlService {
  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  async execute(sessionId: string, request: DisplayControlRequest) {
    request = validateDisplayControl(request);
    const session = this.sessions.get(sessionId);
    this.sessions.assertCapability(
      session,
      request.type === "clipboard" ? "clipboard" : "control",
    );

    try {
      const result = await this.route(session, request);
      this.sessions.touch(sessionId);
      return result;
    } catch (error) {
      if (error instanceof ScrcpyControlDispatchError) {
        throw new ConflictException({
          statusCode: 409,
          code: error.code,
          message: error.message,
        });
      }
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
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

  private route(session: DisplaySession, request: DisplayControlRequest) {
    const { id: sessionId, udid } = session;
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
        session,
        this.scrcpy.sendViewerAction(sessionId, command),
        () => this.adb.viewerAction(udid, command),
        command,
      );
    }
    if (request.type === "keyboard") {
      return this.withFallback(
        session,
        this.scrcpy.sendKeyboardEvent(sessionId, request),
        () => this.adb.keyboardEvent(udid, request),
      );
    }
    if (request.type === "touch") {
      return this.withFallback(
        session,
        this.scrcpy.sendTouchEvent(sessionId, request),
        () => {
          if (request.action === "pointer") {
            throw new ConflictException({
              statusCode: 409,
              code: "control_reconnecting",
              message: "Live pointer controls are unavailable.",
            });
          }
          return this.adb.touchEvent(udid, request);
        },
      );
    }
    if (request.type !== "clipboard") {
      throw new BadRequestException("Invalid viewer control type.");
    }
    return this.withFallback(
      session,
      this.scrcpy.sendClipboard(sessionId, request.text ?? ""),
      () => this.adb.setClipboard(udid, request.text ?? ""),
    );
  }

  private async withFallback(
    session: DisplaySession,
    handledByStream: boolean | Promise<boolean>,
    executeAdb: () => Promise<unknown>,
    command?: ViewerCommand,
  ) {
    if (await handledByStream) {
      return { command, executed: true, transport: "stream-control" as const };
    }
    this.sessions.get(session.id);
    if (
      session.surfaceKind === "virtual" ||
      this.scrcpy.shouldWaitForStreamControl(session.id)
    ) {
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
