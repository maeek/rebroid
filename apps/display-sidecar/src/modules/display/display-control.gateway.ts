import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway } from "@nestjs/websockets";
import { IncomingMessage } from "node:http";
import { RawData, WebSocket } from "ws";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayControlRequest } from "./display.types";
import { DisplayControlService } from "./display-control.service";
import { displayControlError } from "./display-control-response";

@WebSocketGateway({ path: "/rebroid/display/control" })
export class DisplayControlGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DisplayControlGateway.name);

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly controls: DisplayControlService,
  ) {}

  handleConnection(client: WebSocket, request: IncomingMessage) {
    let sessionId: string;

    try {
      const url = new URL(request.url ?? "", "http://display-sidecar.local");
      sessionId = url.searchParams.get("sessionId") ?? "";
      const token = url.searchParams.get("token");
      if (!sessionId) {
        client.close(1008, "Missing sessionId");
        return;
      }

      this.sessions.assertStreamToken(sessionId, token);
    } catch (error) {
      client.close(1008, this.errorMessage(error).slice(0, 120));
      return;
    }

    client.on("message", (raw) => {
      void this.handleMessage(client, sessionId, raw);
    });
  }

  private async handleMessage(
    client: WebSocket,
    sessionId: string,
    raw: RawData,
  ) {
    const message = this.parseMessage(raw);
    if (!message) {
      this.send(client, {
        ok: false,
        code: "invalid_control",
        message: "Invalid viewer control message.",
      });
      return;
    }

    try {
      const result = await this.controls.execute(sessionId, message);
      this.send(client, { id: message.id, ok: true, ...result });
    } catch (error) {
      const failure = displayControlError(error);
      this.logger.debug(
        `[display-control:${sessionId}] control message failed: ${failure.code}`,
      );
      this.send(client, {
        id: message.id,
        ...failure,
      });
    }
  }

  private parseMessage(raw: RawData): DisplayControlRequest | null {
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
        ? (record as DisplayControlRequest)
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

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
