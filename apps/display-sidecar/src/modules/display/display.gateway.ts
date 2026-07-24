import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway } from "@nestjs/websockets";
import { IncomingMessage } from "node:http";
import { WebSocket } from "ws";
import { QueuedScrcpyMediaSink } from "../scrcpy/scrcpy-media-sink";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { DisplaySessionService } from "./display-session.service";
import type { ScrcpyStreamAttachment } from "../scrcpy/scrcpy.types";

const DEFAULT_MAX_SIZE = 0;
const DEFAULT_MAX_FPS = 60;
const DEFAULT_BITRATE = 16_000_000;
const INTERACTIVE_I_FRAME_INTERVAL = 1;

@WebSocketGateway({
  path: "/rebroid/display/stream",
  perMessageDeflate: false,
})
export class DisplayGateway implements OnGatewayConnection {
  private readonly logger = new Logger(DisplayGateway.name);

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage) {
    try {
      const url = new URL(request.url ?? "", "http://display-sidecar.local");
      const sessionId = url.searchParams.get("sessionId");
      const token = url.searchParams.get("token");

      if (!sessionId) {
        client.close(1008, "Missing sessionId");
        return;
      }

      const session = this.sessions.assertStreamToken(sessionId, token);
      this.sessions.assertCapability(session, "video");
      const maxSize = this.nativeMaxSize(url.searchParams.get("maxSize"));
      const maxFps = this.nativeFrameRate(url.searchParams.get("maxFps"));
      const sink = new QueuedScrcpyMediaSink({
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
      try {
        attachment = this.scrcpy.attachStream({
          sessionId,
          udid: session.udid,
          sink,
          codec: "h264",
          displayId: session.displayId,
          newDisplay: session.newDisplay,
          audio: url.searchParams.get("audio") === "1",
          maxSize,
          maxFps,
          bitrate: this.parseNumber(
            url.searchParams.get("bitrate"),
            DEFAULT_BITRATE,
            100_000,
            100_000_000,
          ),
          iFrameInterval: INTERACTIVE_I_FRAME_INTERVAL,
          onActivity: () => {
            this.sessions.touch(sessionId);
          },
        });
        await attachment.closed;
      } finally {
        clearInterval(queueMetricsTimer);
        attachment?.detach("WebSocket consumer closed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Display stream failed: ${message}`);
      if (client.readyState === WebSocket.OPEN) {
        client.close(1011, message.slice(0, 120));
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

  private nativeMaxSize(value: string | null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_SIZE;
    }

    const rounded = Math.round(parsed);
    if (rounded === 0) {
      return 0;
    }
    throw new Error(
      "Interactive display streaming requires native resolution (maxSize=0).",
    );
  }

  private nativeFrameRate(value: string | null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_FPS;
    }
    if (Math.round(parsed) === DEFAULT_MAX_FPS) {
      return DEFAULT_MAX_FPS;
    }
    throw new Error("Interactive display streaming requires maxFps=60.");
  }

  private parseNumber(
    value: string | null,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(Math.round(parsed), min), max);
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
