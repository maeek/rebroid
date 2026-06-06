import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway } from "@nestjs/websockets";
import { IncomingMessage } from "node:http";
import { RawData, WebSocket } from "ws";
import { AdbService, ViewerCommand } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { VIEWER_CONTROL_COMMANDS } from "../scrcpy/scrcpy-control-codec";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayKeyboardBody, DisplayTouchBody } from "./display.types";

type DisplayControlMessage =
  | { id?: string; type: "action"; command?: string }
  | ({ id?: string; type: "keyboard" } & DisplayKeyboardBody)
  | ({ id?: string; type: "touch" } & DisplayTouchBody)
  | { id?: string; type: "clipboard"; text?: string };

@WebSocketGateway({ path: "/rebroid/display/control" })
export class DisplayControlGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DisplayControlGateway.name);

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  handleConnection(client: WebSocket, request: IncomingMessage) {
    let sessionId: string;
    let udid: string;

    try {
      const url = new URL(request.url ?? "", "http://display-sidecar.local");
      sessionId = url.searchParams.get("sessionId") ?? "";
      const token = url.searchParams.get("token");
      if (!sessionId) {
        client.close(1008, "Missing sessionId");
        return;
      }

      const session = this.sessions.assertStreamToken(sessionId, token);
      udid = session.udid;
    } catch (error) {
      client.close(1008, this.errorMessage(error).slice(0, 120));
      return;
    }

    client.on("message", (raw) => {
      void this.handleMessage(client, sessionId, udid, raw);
    });
  }

  private async handleMessage(
    client: WebSocket,
    sessionId: string,
    udid: string,
    raw: RawData,
  ) {
    const message = this.parseMessage(raw);
    if (!message) {
      this.send(client, {
        ok: false,
        message: "Invalid viewer control message.",
      });
      return;
    }

    try {
      const session = this.sessions.get(sessionId);
      this.sessions.assertCapability(
        session,
        message.type === "clipboard" ? "clipboard" : "control",
      );
      const result = await this.executeControlMessage(sessionId, udid, message);
      this.sessions.touch(sessionId);
      this.send(client, { id: message.id, ok: true, ...result });
    } catch (error) {
      const messageText = this.errorMessage(error);
      this.logger.debug(
        `[display-control:${sessionId}] control message failed: ${messageText}`,
      );
      this.send(client, {
        id: message.id,
        ok: false,
        message: this.publicErrorMessage(messageText),
      });
    }
  }

  private async executeControlMessage(
    sessionId: string,
    udid: string,
    message: DisplayControlMessage,
  ) {
    if (message.type === "action") {
      return this.executeAction(
        sessionId,
        udid,
        message.command,
      );
    }

    if (message.type === "keyboard") {
      const handledByStream = this.scrcpy.sendKeyboardEvent(sessionId, message);
      if (handledByStream) {
        return { executed: true, transport: "stream-control" };
      }

      return this.executeAdbFallback(sessionId, () =>
        this.adb.keyboardEvent(udid, message),
      );
    }

    if (message.type === "touch") {
      const handledByStream = this.scrcpy.sendTouchEvent(sessionId, message);
      if (handledByStream) {
        return { executed: true, transport: "stream-control" };
      }

      return this.executeAdbFallback(sessionId, () =>
        this.adb.touchEvent(udid, message),
      );
    }

    if (message.type === "clipboard") {
      const handledByStream = this.scrcpy.sendClipboard(
        sessionId,
        message.text ?? "",
      );
      if (handledByStream) {
        return { executed: true, transport: "stream-control" };
      }

      return this.executeAdbFallback(sessionId, () =>
        this.adb.setClipboard(udid, message.text ?? ""),
      );
    }

    return { executed: false };
  }

  private async executeAction(
    sessionId: string,
    udid: string,
    command: string | undefined,
  ) {
    if (!command || !VIEWER_CONTROL_COMMANDS.has(command as ViewerCommand)) {
      throw new Error(
        `Unsupported display action command: ${command ?? "missing"}`,
      );
    }

    const viewerCommand = command as ViewerCommand;
    const handledByStream = this.scrcpy.sendViewerAction(
      sessionId,
      viewerCommand,
    );
    if (handledByStream) {
      return {
        command: viewerCommand,
        executed: true,
        transport: "stream-control",
      };
    }

    return this.executeAdbFallback(sessionId, () =>
      this.adb.viewerAction(udid, viewerCommand),
    );
  }

  private async executeAdbFallback(
    sessionId: string,
    execute: () => Promise<unknown>,
  ) {
    if (this.scrcpy.shouldWaitForStreamControl(sessionId)) {
      throw new Error("Live controls are reconnecting. Try again in a moment.");
    }

    await execute();
    return { executed: true, transport: "adb" };
  }

  private parseMessage(raw: RawData): DisplayControlMessage | null {
    try {
      const text = Array.isArray(raw)
        ? Buffer.concat(raw).toString("utf8")
        : Buffer.isBuffer(raw)
          ? raw.toString("utf8")
          : raw instanceof ArrayBuffer
            ? Buffer.from(raw).toString("utf8")
            : Buffer.from(raw as Buffer).toString("utf8");
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const record = parsed as Record<string, unknown>;
      return typeof record.type === "string"
        ? (record as DisplayControlMessage)
        : null;
    } catch {
      return null;
    }
  }

  private send(client: WebSocket, payload: unknown) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }

  private publicErrorMessage(message: string) {
    return (
      message ||
      "The viewer could not send that command. Refresh the viewer or restart the app, then try again."
    );
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
