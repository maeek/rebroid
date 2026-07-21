import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import {
  SCRCPY_WS_OPEN,
  ScrcpyAudioPacket,
  ScrcpyStreamClient,
} from "../scrcpy/scrcpy.types";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayControlRequest } from "./display.types";
import { DisplayControlService } from "./display-control.service";
import { displayControlError } from "./display-control-response";

type WebrtcOfferOptions = {
  sessionId: string;
  token: string | null;
  sdp: string;
  requestHost: string | null;
  bitrate?: number;
  maxFps?: number;
  maxSize?: number;
  iFrameInterval?: number;
  audio: boolean;
};

type BridgeMessage =
  | { type: "answer"; sdp: string }
  | { type: "control"; payload: unknown }
  | { type: "state"; state: string }
  | { type: "log"; message: string }
  | { type: "error"; message: string };

const DEFAULT_MAX_SIZE = 1080;
const DEFAULT_MAX_FPS = 60;
const DEFAULT_BITRATE = 7_000_000;

@Injectable()
export class DisplayWebrtcService {
  private readonly logger = new Logger(DisplayWebrtcService.name);
  private readonly active = new Map<string, () => void>();

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly scrcpy: ScrcpyService,
    private readonly config: SidecarConfigService,
    private readonly controls: DisplayControlService,
  ) {}

  async createAnswer(options: WebrtcOfferOptions) {
    const session = this.sessions.assertStreamToken(
      options.sessionId,
      options.token,
    );
    this.sessions.assertCapability(session, "video");
    await this.scrcpy.assertTargetSupported(session.udid);
    const iceHost = this.resolveIceHost(options.requestHost);
    if (!iceHost) {
      throw new ConflictException("Could not determine WebRTC ICE host.");
    }

    this.stopSession(options.sessionId);
    const bridge = spawn(this.config.webrtcBridgePath, [], {
      stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
    });
    const videoInput = bridge.stdio[3] as Writable;
    const audioInput = bridge.stdio[4] as Writable;
    const client = new BridgeScrcpyClient(bridge, videoInput, audioInput);
    this.active.set(options.sessionId, () => client.close());

    bridge.stderr.setEncoding("utf8");
    bridge.stderr.on("data", (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line.trim()) {
          this.logger.debug(`[webrtc:${options.sessionId}] ${line}`);
        }
      }
    });

    bridge.once("close", (code, signal) => {
      this.active.delete(options.sessionId);
      client.close();
      this.logger.debug(
        `[webrtc:${options.sessionId}] bridge closed code=${code ?? 0}${signal ? ` signal=${signal}` : ""}`,
      );
    });

    const answer = await this.configureBridge({
      bridge,
      sessionId: options.sessionId,
      offerSdp: options.sdp,
      iceHost,
      maxFps: this.number(options.maxFps, DEFAULT_MAX_FPS, 1, 120),
      audio: options.audio,
    });

    void this.scrcpy
      .streamRawVideo({
        sessionId: options.sessionId,
        udid: session.udid,
        client,
        codec: "h264",
        displayId: session.displayId,
        newDisplay: session.newDisplay,
        audio: options.audio,
        maxSize: this.maxSize(options.maxSize),
        maxFps: this.number(options.maxFps, DEFAULT_MAX_FPS, 1, 120),
        bitrate: this.number(
          options.bitrate,
          DEFAULT_BITRATE,
          100_000,
          100_000_000,
        ),
        iFrameInterval: this.optionalNumber(options.iFrameInterval, 1, 60),
        onActivity: () => this.sessions.touch(options.sessionId),
      })
      .catch((error) => {
        this.logger.warn(
          `[webrtc:${options.sessionId}] scrcpy stream failed: ${this.errorMessage(error)}`,
        );
        client.close();
      });

    return {
      transport: "webrtc" as const,
      codec: "h264" as const,
      sdp: answer.sdp,
      iceServers: this.config.webrtcStunUrls,
    };
  }

  private configureBridge({
    bridge,
    sessionId,
    offerSdp,
    iceHost,
    maxFps,
    audio,
  }: {
    bridge: ChildProcess;
    sessionId: string;
    offerSdp: string;
    iceHost: string;
    maxFps: number;
    audio: boolean;
  }) {
    return new Promise<{ sdp: string }>((resolve, reject) => {
      let settled = false;
      let buffer = "";
      const timeout = setTimeout(
        () => fail(new Error("Timed out creating WebRTC answer.")),
        10_000,
      );

      const cleanup = () => {
        clearTimeout(timeout);
        bridge.off("error", onError);
        bridge.off("close", onClose);
      };
      const fail = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        bridge.kill("SIGTERM");
        reject(error);
      };
      const onError = (error: Error) => fail(error);
      const onClose = () =>
        fail(new Error("WebRTC bridge exited before answering."));
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          this.handleBridgeLine(bridge, sessionId, line, (sdp) => {
            if (settled) {
              return;
            }
            settled = true;
            cleanup();
            resolve({ sdp });
          });
          newline = buffer.indexOf("\n");
        }
      };

      bridge.stdout?.on("data", onData);
      bridge.once("error", onError);
      bridge.once("close", onClose);
      bridge.stdin?.write(
        `${JSON.stringify({
          type: "offer",
          sdp: offerSdp,
          iceHost,
          udpPortRange: this.config.webrtcUdpPortRange,
          stunUrls: this.config.webrtcStunUrls,
          maxFps,
          audio,
        })}\n`,
      );
    });
  }

  private handleBridgeLine(
    bridge: ChildProcess,
    sessionId: string,
    line: string,
    onAnswer?: (sdp: string) => void,
  ) {
    if (!line) {
      return;
    }
    let message: BridgeMessage;
    try {
      message = JSON.parse(line) as BridgeMessage;
    } catch {
      this.logger.debug(`[webrtc:${sessionId}] ${line}`);
      return;
    }

    if (message.type === "answer") {
      onAnswer?.(message.sdp);
      return;
    }
    if (message.type === "control") {
      void this.handleControlMessage(sessionId, message.payload)
        .then((payload) => this.sendDataChannelMessage(bridge, payload))
        .catch((error) => {
          const failure = displayControlError(error);
          this.logger.warn(
            `[webrtc:${sessionId}] control message failed: ${failure.code}`,
          );
          this.sendDataChannelMessage(bridge, failure);
        });
      return;
    }
    if (message.type === "error") {
      this.logger.warn(`[webrtc:${sessionId}] ${message.message}`);
      return;
    }
    if (message.type === "log" || message.type === "state") {
      this.logger.debug(
        `[webrtc:${sessionId}] ${message.type === "state" ? message.state : message.message}`,
      );
    }
  }

  private async handleControlMessage(sessionId: string, payload: unknown) {
    const message = this.parseControlMessage(payload);
    if (!message) {
      return {
        ok: false as const,
        code: "invalid_control",
        message: "Invalid viewer control message.",
      };
    }
    return {
      id: message.id,
      ok: true as const,
      ...(await this.controls.execute(sessionId, message)),
    };
  }

  private sendDataChannelMessage(bridge: ChildProcess, payload: unknown) {
    bridge.stdin?.write(
      `${JSON.stringify({ type: "datachannel", payload })}\n`,
    );
  }

  private parseControlMessage(payload: unknown): DisplayControlRequest | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    return typeof record.type === "string"
      ? (record as DisplayControlRequest)
      : null;
  }

  stopSession(sessionId: string) {
    this.active.get(sessionId)?.();
    this.active.delete(sessionId);
  }

  private resolveIceHost(requestHost: string | null) {
    if (this.config.webrtcIceHostOverride) {
      return this.config.webrtcIceHostOverride;
    }
    const first = requestHost?.split(",")[0]?.trim();
    if (!first) {
      return "";
    }
    return first.startsWith("[")
      ? first.slice(1, first.indexOf("]"))
      : first.split(":")[0];
  }

  private number(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? Math.min(Math.max(Math.round(parsed), min), max)
      : fallback;
  }

  private optionalNumber(value: number | undefined, min: number, max: number) {
    return value === undefined ? undefined : this.number(value, min, min, max);
  }

  private maxSize(value: number | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return DEFAULT_MAX_SIZE;
    }
    if (Math.round(parsed) === 0) {
      return 0;
    }
    return Math.min(Math.max(Math.round(parsed), 1080), 4096);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

class BridgeScrcpyClient extends EventEmitter implements ScrcpyStreamClient {
  readyState: number = SCRCPY_WS_OPEN;
  bufferedAmount = 0;
  audioBufferedAmount = 0;

  constructor(
    private readonly process: ChildProcess,
    private readonly videoInput: Writable,
    private readonly audioInput: Writable,
  ) {
    super();
  }

  send(
    data: Buffer | string,
    optionsOrCallback?: { binary?: boolean } | ((error?: Error) => void),
    callback?: (error?: Error) => void,
  ) {
    const done =
      typeof optionsOrCallback === "function" ? optionsOrCallback : callback;
    if (typeof data === "string") {
      try {
        this.process.stdin?.write(
          `${JSON.stringify({ type: "datachannel", payload: JSON.parse(data) })}\n`,
          (error) => {
            done?.(error ?? undefined);
          },
        );
      } catch (error) {
        done?.(error instanceof Error ? error : new Error(String(error)));
      }
      return;
    }
    this.bufferedAmount += data.byteLength;
    this.videoInput.write(data, (error) => {
      this.bufferedAmount = Math.max(0, this.bufferedAmount - data.byteLength);
      done?.(error ?? undefined);
    });
  }

  sendAudio(packet: ScrcpyAudioPacket, done?: (error?: Error) => void) {
    if (packet.config) {
      done?.();
      return;
    }
    const header = Buffer.alloc(12);
    header.writeBigInt64BE(packet.timestampUs);
    header.writeUInt32BE(packet.data.byteLength, 8);
    this.audioBufferedAmount += header.byteLength + packet.data.byteLength;
    this.audioInput.write(Buffer.concat([header, packet.data]), (error) => {
      this.audioBufferedAmount = Math.max(
        0,
        this.audioBufferedAmount - header.byteLength - packet.data.byteLength,
      );
      done?.(error ?? undefined);
    });
  }

  close() {
    if (this.readyState !== SCRCPY_WS_OPEN) {
      return;
    }
    this.readyState = 3;
    this.videoInput.end();
    this.audioInput.end();
    this.process.kill("SIGTERM");
    this.emit("close");
  }
}
