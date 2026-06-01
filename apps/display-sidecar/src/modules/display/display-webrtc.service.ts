import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { AdbService, ViewerCommand } from "../adb/adb.service";
import { ScrcpyService } from "../scrcpy/scrcpy.service";
import { VIEWER_CONTROL_COMMANDS } from "../scrcpy/scrcpy-control-codec";
import {
  SCRCPY_WS_OPEN,
  ScrcpyAudioPacket,
  ScrcpyStreamClient,
} from "../scrcpy/scrcpy.types";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DisplaySessionService } from "./display-session.service";
import type { DisplayKeyboardBody, DisplayTouchBody } from "./display.types";

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

type DisplayControlMessage =
  | { id?: string; type: "action"; command?: string; action?: string }
  | ({ id?: string; type: "keyboard" } & DisplayKeyboardBody)
  | ({ id?: string; type: "touch" } & DisplayTouchBody)
  | { id?: string; type: "clipboard"; text?: string };

const DEFAULT_MAX_SIZE = 1080;
const DEFAULT_MAX_FPS = 60;
const DEFAULT_BITRATE = 7_000_000;

@Injectable()
export class DisplayWebrtcService {
  private readonly logger = new Logger(DisplayWebrtcService.name);
  private readonly active = new Map<string, () => void>();

  constructor(
    private readonly sessions: DisplaySessionService,
    private readonly adb: AdbService,
    private readonly scrcpy: ScrcpyService,
    private readonly config: SidecarConfigService,
  ) {}

  async createAnswer(options: WebrtcOfferOptions) {
    const session = this.sessions.assertStreamToken(
      options.sessionId,
      options.token,
    );
    this.sessions.assertCapability(session, "video");
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
          this.handleBridgeLine(sessionId, line, (sdp) => {
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
      void this.handleControlMessage(sessionId, message.payload).catch(
        (error) => {
          this.logger.warn(
            `[webrtc:${sessionId}] control message failed: ${this.errorMessage(error)}`,
          );
        },
      );
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
    const session = this.sessions.get(sessionId);
    const message = this.parseControlMessage(payload);
    if (!message) {
      return;
    }
    this.sessions.assertCapability(
      session,
      message.type === "clipboard" ? "clipboard" : "control",
    );
    this.sessions.touch(sessionId);
    if (message.type === "action") {
      await this.executeAction(
        sessionId,
        session.udid,
        message.command ?? message.action,
      );
    } else if (message.type === "keyboard") {
      const handled = this.scrcpy.sendKeyboardEvent(sessionId, message);
      if (!handled) {
        await this.adb.keyboardEvent(session.udid, message);
      }
    } else if (message.type === "touch") {
      const handled = this.scrcpy.sendTouchEvent(sessionId, message);
      if (!handled) {
        await this.adb.touchEvent(session.udid, message);
      }
    } else if (message.type === "clipboard") {
      const handled = this.scrcpy.sendClipboard(sessionId, message.text ?? "");
      if (!handled) {
        await this.adb.setClipboard(session.udid, message.text ?? "");
      }
    }
  }

  private async executeAction(
    sessionId: string,
    udid: string,
    command: string | undefined,
  ) {
    if (!command || !VIEWER_CONTROL_COMMANDS.has(command as ViewerCommand)) {
      return;
    }
    const handled = this.scrcpy.sendViewerAction(
      sessionId,
      command as ViewerCommand,
    );
    if (!handled) {
      await this.adb.viewerAction(udid, command as ViewerCommand);
    }
  }

  private parseControlMessage(payload: unknown): DisplayControlMessage | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    return typeof record.type === "string"
      ? (record as DisplayControlMessage)
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
    this.bufferedAmount += header.byteLength + packet.data.byteLength;
    this.audioInput.write(Buffer.concat([header, packet.data]), (error) => {
      this.bufferedAmount = Math.max(
        0,
        this.bufferedAmount - header.byteLength - packet.data.byteLength,
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
