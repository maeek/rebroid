import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway } from "@nestjs/websockets";
import { IncomingMessage } from "node:http";
import { RawData, WebSocket } from "ws";
import { DisplayViewerAccessService } from "./display-viewer-access.service";
import type { DisplayControlRequest } from "./display.types";
import { DisplayControlService } from "./display-control.service";
import { displayControlError } from "./display-control-response";

@WebSocketGateway({ path: "/rebroid/display/control", maxPayload: 256 * 1024 })
export class DisplayControlGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DisplayControlGateway.name);

  constructor(
    private readonly access: DisplayViewerAccessService,
    private readonly controls: DisplayControlService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    try {
      const url = new URL(request.url ?? "", "http://display-sidecar.local");
      const sessionId = url.searchParams.get("sessionId") ?? "";
      if (!sessionId) {
        client.close(1008, "Missing sessionId");
        return;
      }

      const admission = await this.access.admit(sessionId, request.headers);
      if (client.readyState !== WebSocket.OPEN) return;
      const stopWatching = admission.watch(() =>
        client.close(4404, "Display session not found."),
      );
      const connection = new AbortController();
      client.once("close", () => {
        stopWatching();
        connection.abort();
      });
      client.on("message", (raw) => {
        if (client.readyState === WebSocket.OPEN) {
          void this.handleMessage(client, sessionId, raw, connection.signal);
        }
      });
      this.send(client, {
        type: "control-ready",
        canControl: admission.session.capabilities.includes("control"),
      });
    } catch (error) {
      client.close(1008, this.errorMessage(error).slice(0, 120));
    }
  }

  private async handleMessage(
    client: WebSocket,
    sessionId: string,
    raw: RawData,
    connection: AbortSignal,
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

    const id =
      typeof message.id === "string" ? message.id.slice(0, 128) : undefined;
    try {
      const result = await this.controls.execute(
        sessionId,
        message,
        connection,
      );
      if (message.type !== "scroll" || id)
        this.send(client, { id, ok: true, ...result });
    } catch (error) {
      if (message.type === "scroll" && !id) return;
      const failure = displayControlError(error);
      this.logger.debug(
        `[display-control:${sessionId}] control message failed: ${failure.code}`,
      );
      this.send(client, {
        id,
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
