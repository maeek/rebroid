import {
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway } from "@nestjs/websockets";
import { IncomingMessage } from "node:http";
import { WebSocket } from "ws";
import { QueuedScrcpyMediaSink } from "../scrcpy/scrcpy-media-sink";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { DisplaySessionService } from "./display-session.service";
import { DisplayViewerAccessService } from "./display-viewer-access.service";
import type { ScrcpyStreamAttachment } from "../scrcpy/scrcpy.types";
import { resolveDisplayStreamProfile } from "./display-stream-profile";

@WebSocketGateway({
  path: "/rebroid/display/stream",
  perMessageDeflate: false,
})
export class DisplayGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DisplayGateway.name);

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly access: DisplayViewerAccessService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    try {
      const url = new URL(request.url ?? "", "http://display-sidecar.local");
      const sessionId = url.searchParams.get("sessionId");

      if (!sessionId) {
        client.close(1008, "Missing sessionId");
        return;
      }

      const admission = await this.access.admit(sessionId, request.headers);
      if (client.readyState !== WebSocket.OPEN) return;
      const { session } = admission;
      this.sessions.assertCapability(session, "video");
      const profile = resolveDisplayStreamProfile({
        maxSize: url.searchParams.get("maxSize"),
        maxFps: url.searchParams.get("maxFps"),
        bitrate: url.searchParams.get("bitrate"),
      });
      const sink = new QueuedScrcpyMediaSink({
        allowClipboard: session.capabilities.includes("clipboard"),
        isOpen: () => client.readyState === WebSocket.OPEN,
        onClose: (listener) => client.once("close", listener),
        writeStatus: (payload) => client.send(payload),
        writeVideo: (payload) => this.writeBinary(client, payload),
        writeAudio: (payload) => this.writeBinary(client, payload),
        close: (code, reason) => client.close(code, reason),
      });
      let attachment: ScrcpyStreamAttachment | null = null;
      let browserWatermark: {
        generation: number;
        receivedSequence?: number;
        decodedSequence?: number;
        presentedSequence?: number;
      } | null = null;
      client.on("message", (data, isBinary) => {
        if (
          isBinary ||
          Array.isArray(data) ||
          data.byteLength > 512 ||
          !attachment
        ) {
          return;
        }
        try {
          const message = JSON.parse(data.toString()) as Record<
            string,
            unknown
          >;
          if (
            message.type === "video-resync-request" &&
            typeof message.reason === "string" &&
            message.reason.length <= 120 &&
            Number.isInteger(message.generation)
          ) {
            attachment.requestVideoReset(
              `websocket:${message.reason.slice(0, 100)}`,
            );
            return;
          }
          if (
            message.type === "consumer-watermark" &&
            Number.isInteger(message.generation) &&
            this.isOptionalSequence(message.receivedSequence) &&
            this.isOptionalSequence(message.decodedSequence) &&
            this.isOptionalSequence(message.presentedSequence)
          ) {
            browserWatermark = {
              generation: Number(message.generation),
              receivedSequence: this.optionalSequence(message.receivedSequence),
              decodedSequence: this.optionalSequence(message.decodedSequence),
              presentedSequence: this.optionalSequence(
                message.presentedSequence,
              ),
            };
          }
        } catch {
          // Media sockets accept only the bounded resync control message.
        }
      });
      let previousSourceFrames = 0;
      let previousSourceBytes = 0;
      let previousSnapshotAt = Date.now();
      const queueMetricsTimer = setInterval(() => {
        const snapshotAt = Date.now();
        const snapshot = sink.snapshot();
        const elapsedSeconds = Math.max(
          (snapshotAt - previousSnapshotAt) / 1_000,
          0.001,
        );
        sink.sendStatus({
          type: "relay-metrics",
          metrics: {
            sourceFps:
              (snapshot.sourceVideoFrames - previousSourceFrames) /
              elapsedSeconds,
            sourceBitrateMbps:
              (((snapshot.sourceVideoBytes ?? 0) - previousSourceBytes) * 8) /
              elapsedSeconds /
              1_000_000,
            sourceFrameSizeP95Bytes: snapshot.sourceFrameSizeP95Bytes,
            keyFrameSizeBytes: snapshot.lastKeyFrameBytes,
            sourceInterFrameP95Ms: snapshot.sourceInterFrameP95Ms,
            droppedFrames: snapshot.video.droppedFrames,
            queueDepthMs: snapshot.video.queueDepthMs,
            relayP95Ms: snapshot.scrcpyReadToSinkWriteP95Ms,
            relayP99Ms: snapshot.scrcpyReadToSinkWriteP99Ms,
            eventLoopUtilization: snapshot.eventLoopUtilization,
            gcPauseP95Ms: snapshot.gcPauseP95Ms,
            browserGeneration: browserWatermark?.generation,
            browserReceivedSequence: browserWatermark?.receivedSequence,
            browserDecodedSequence: browserWatermark?.decodedSequence,
            browserPresentedSequence: browserWatermark?.presentedSequence,
            browserPresentationLagFrames: this.sequenceLag(
              snapshot.lastVideoSequence,
              browserWatermark?.presentedSequence,
            ),
          },
        });
        previousSourceFrames = snapshot.sourceVideoFrames;
        previousSourceBytes = snapshot.sourceVideoBytes ?? 0;
        previousSnapshotAt = snapshotAt;
      }, 1_000);
      queueMetricsTimer.unref?.();
      let stopWatching: (() => void) | undefined;
      try {
        stopWatching = admission.watch(() => {
          client.close(4404, "Display session not found.");
          attachment?.detach("Viewer access revoked");
        });
        attachment = this.scrcpy.attachStream({
          sessionId,
          udid: session.udid,
          sink,
          codec: "h264",
          displayId: session.displayId,
          newDisplay: session.newDisplay,
          audio:
            session.capabilities.includes("audio") &&
            url.searchParams.get("audio") === "1",
          ...profile,
          onActivity: () => {
            this.sessions.touch(sessionId);
          },
        });
        await attachment.closed;
      } finally {
        stopWatching?.();
        clearInterval(queueMetricsTimer);
        attachment?.detach("WebSocket consumer closed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Display stream failed: ${message}`);
      if (client.readyState === WebSocket.OPEN) {
        let code = 1011;
        if (error instanceof NotFoundException) code = 4404;
        if (error instanceof UnauthorizedException) code = 1008;
        client.close(code, message.slice(0, 120));
      }
    }
  }

  private writeBinary(client: WebSocket, payload: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (client.readyState !== WebSocket.OPEN) {
        reject(new Error("Display WebSocket is closed."));
        return;
      }
      client.send(payload, { binary: true }, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private isOptionalSequence(value: unknown): boolean {
    return (
      value === undefined ||
      (Number.isInteger(value) &&
        Number(value) >= 0 &&
        Number(value) <= 0xffffffff)
    );
  }

  private optionalSequence(value: unknown): number | undefined {
    return value === undefined ? undefined : Number(value) >>> 0;
  }

  private sequenceLag(
    newest: number | undefined,
    older: number | undefined,
  ): number | undefined {
    if (newest === undefined || older === undefined) {
      return undefined;
    }
    return (newest - older) >>> 0;
  }
}
