import { Injectable, Logger } from "@nestjs/common";
import { createServer, Server, Socket } from "node:net";
import { AdbService } from "../adb/adb.service";
import type { AdbChildProcess, ViewerCommand } from "../adb/adb.service";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DirectAdbConnection } from "./direct-adb-connection";
import { ScrcpyControlCodec } from "./scrcpy-control-codec";
import {
  ForwardedVideoSocket,
  SCRCPY_WS_OPEN,
  ScrcpyAudioPacket,
  ScrcpyAttemptResult,
  ScrcpyKeyboardEventPayload,
  ScrcpySocket,
  ScrcpyStreamClient,
  ScrcpyStreamOptions,
  ScrcpyTouchEventPayload,
  ScrcpyTunnelMode,
} from "./scrcpy.types";

const LOCALHOST = "127.0.0.1";
const SOCKET_CONNECT_TIMEOUT_MS = 10_000;
const WS_HIGH_WATERMARK_BYTES = 8 * 1024 * 1024;
const WS_LOW_WATERMARK_BYTES = 2 * 1024 * 1024;
const STREAM_RESTART_BACKOFF_MS = 500;
const SCRCPY_CONNECT_RETRY_DELAY_MS = 100;
const REVERSE_SOCKET_ACCEPT_TIMEOUT_MS = 1_500;
const MAX_QUEUED_CONTROL_MESSAGES = 128;
const MAX_QUEUED_CONTROL_AGE_MS = 10_000;
const SCRCPY_TUNNEL_MODE = process.env.SCRCPY_TUNNEL_MODE?.trim().toLowerCase();
const SCRCPY_SERVER_LOG_LEVEL =
  process.env.SCRCPY_SERVER_LOG_LEVEL?.trim() || "debug";
const SCRCPY_CONTROL_CHANNEL =
  process.env.SCRCPY_CONTROL_CHANNEL?.trim().toLowerCase() !== "false";
const SCRCPY_LOGCAT_ON_SERVER_EXIT =
  process.env.SCRCPY_LOGCAT_ON_SERVER_EXIT?.trim().toLowerCase() !== "false";
const SCRCPY_SERVER_LAUNCH_MODE =
  process.env.SCRCPY_SERVER_LAUNCH_MODE?.trim().toLowerCase();
const SCRCPY_LOGCAT_INTERVAL_MS = 10_000;
const SCRCPY_CLEAN_EXIT_DOWNGRADE_MS = 15_000;
const SCRCPY_STABLE_BITRATE = Number(
  process.env.SCRCPY_STABLE_BITRATE ?? 3_000_000,
);
const SCRCPY_STABLE_MAX_FPS = Number(process.env.SCRCPY_STABLE_MAX_FPS ?? 24);
const SCRCPY_STABLE_MAX_SIZE = Number(
  process.env.SCRCPY_STABLE_MAX_SIZE ?? 720,
);
const SCRCPY_STABLE_I_FRAME_INTERVAL = Number(
  process.env.SCRCPY_STABLE_I_FRAME_INTERVAL ?? 2,
);
const DEVICE_MESSAGE_CLIPBOARD = 0;
const DEVICE_MESSAGE_ACK_CLIPBOARD = 1;
const SCRCPY_PACKET_HEADER_BYTES = 12;
const SCRCPY_CODEC_H264 = 0x68323634;
const SCRCPY_CODEC_H265 = 0x68323635;
const SCRCPY_CODEC_OPUS = 0x6f707573;
const SCRCPY_PACKET_FLAG_SESSION = 0x80;
const SCRCPY_PACKET_FLAG_CONFIG = 0x40;
const SCRCPY_PACKET_PTS_MASK = (1n << 61n) - 1n;
const MAX_SCRCPY_PACKET_BYTES = 16 * 1024 * 1024;
const AUDIO_PACKET_MAGIC = Buffer.from("RA01");
const AUDIO_PACKET_HEADER_BYTES = AUDIO_PACKET_MAGIC.length + 1 + 8;
const AUDIO_CONFIGURATION_FAILURE_REASON =
  "invalid audio stream: scrcpy stream configuration failed on the device";

interface ActiveControlSocket {
  socket: ScrcpySocket;
  udid: string;
}

interface QueuedControlMessage {
  payloads: Buffer[];
  queuedAt: number;
}

interface ScrcpyServerLaunch {
  process: AdbChildProcess;
  detached: boolean;
}

interface ReverseSocketAcceptor {
  port: number;
  acceptSocket: (timeoutMs?: number) => Promise<Socket>;
  close: () => Promise<void>;
}

interface ScrcpyPacket {
  data: Buffer;
  timestampUs: bigint;
  config: boolean;
}

class ScrcpyPacketParser {
  private buffer = Buffer.alloc(0);
  private codecRead = false;

  constructor(
    private readonly expectedCodec: number,
    private readonly allowSessionPackets: boolean,
    private readonly onPacket: (packet: ScrcpyPacket) => void,
    private readonly onDisabled?: () => void,
  ) {}

  push(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.codecRead) {
      if (this.buffer.length < 4) {
        return;
      }
      const codec = this.buffer.readUInt32BE(0);
      this.buffer = this.buffer.subarray(4);
      this.codecRead = true;
      if (codec === 0) {
        this.onDisabled?.();
        this.buffer = Buffer.alloc(0);
        return;
      }
      if (codec === 1) {
        throw new Error("scrcpy stream configuration failed on the device");
      }
      if (codec !== this.expectedCodec) {
        throw new Error(
          `Unexpected scrcpy stream codec: 0x${codec.toString(16)}`,
        );
      }
    }

    while (this.buffer.length >= SCRCPY_PACKET_HEADER_BYTES) {
      if ((this.buffer[0] & SCRCPY_PACKET_FLAG_SESSION) !== 0) {
        if (!this.allowSessionPackets) {
          throw new Error("Unexpected scrcpy session packet in audio stream");
        }
        this.buffer = this.buffer.subarray(SCRCPY_PACKET_HEADER_BYTES);
        continue;
      }

      const packetBytes = this.buffer.readUInt32BE(8);
      if (!packetBytes || packetBytes > MAX_SCRCPY_PACKET_BYTES) {
        throw new Error(`Invalid scrcpy packet length: ${packetBytes}`);
      }
      const totalBytes = SCRCPY_PACKET_HEADER_BYTES + packetBytes;
      if (this.buffer.length < totalBytes) {
        return;
      }

      const ptsAndFlags = this.buffer.readBigUInt64BE(0);
      this.onPacket({
        data: this.buffer.subarray(SCRCPY_PACKET_HEADER_BYTES, totalBytes),
        timestampUs: ptsAndFlags & SCRCPY_PACKET_PTS_MASK,
        config: (this.buffer[0] & SCRCPY_PACKET_FLAG_CONFIG) !== 0,
      });
      this.buffer = this.buffer.subarray(totalBytes);
    }
  }
}

@Injectable()
export class ScrcpyService {
  private readonly logger = new Logger(ScrcpyService.name);
  private readonly controlCodec = new ScrcpyControlCodec();
  private readonly controlSockets = new Map<string, ActiveControlSocket>();
  private readonly streamingSessions = new Set<string>();
  private readonly streamClients = new Map<string, ScrcpyStreamClient>();
  private readonly queuedControlMessages = new Map<
    string,
    QueuedControlMessage[]
  >();
  private readonly lastLogcatDiagnosticsAt = new Map<string, number>();

  constructor(
    private readonly adb: AdbService,
    private readonly config: SidecarConfigService,
  ) {}

  async streamRawVideo(options: ScrcpyStreamOptions) {
    let clientClosed = false;
    let stopCurrentAttempt: (() => Promise<void>) | null = null;
    let streamedOnce = false;
    let restartAttempt = 0;
    let effectiveOptions = { ...options };
    this.streamingSessions.add(options.sessionId);
    this.streamClients.set(options.sessionId, options.client);

    options.client.once("close", () => {
      clientClosed = true;
      this.runInBackground(
        stopCurrentAttempt?.(),
        `[scrcpy:${options.udid}:${options.sessionId}] client close cleanup`,
      );
    });

    try {
      while (!clientClosed && options.client.readyState === SCRCPY_WS_OPEN) {
        try {
          const result = await this.streamRawVideoAttempt(
            effectiveOptions,
            (stop) => {
              stopCurrentAttempt = stop;
            },
          );
          stopCurrentAttempt = null;

          if (clientClosed || options.client.readyState !== SCRCPY_WS_OPEN) {
            return;
          }

          streamedOnce = true;
          const audioWasEnabled = effectiveOptions.audio;
          effectiveOptions = this.nextEffectiveStreamOptions(
            effectiveOptions,
            result,
          );
          if (audioWasEnabled && !effectiveOptions.audio) {
            this.logger.debug(
              `[scrcpy:${options.udid}:${options.sessionId}] Android audio configuration failed; retrying with video only`,
            );
            this.sendJson(options.client, { type: "audio-disabled" });
          }
          restartAttempt = result.durationMs > 30_000 ? 0 : restartAttempt + 1;
          const delayMs = this.restartDelayMs(restartAttempt);
          this.logger.debug(
            `[scrcpy:${options.udid}:${options.sessionId}] restarting display stream after: ${result.reason}; delayMs=${delayMs}`,
          );
          this.sendJson(options.client, {
            type: "reconnecting",
            message: "Reconnecting live display...",
          });
          await this.delay(delayMs);
        } catch (error) {
          stopCurrentAttempt = null;

          if (!streamedOnce) {
            throw error;
          }

          if (clientClosed || options.client.readyState !== SCRCPY_WS_OPEN) {
            return;
          }

          restartAttempt += 1;
          const delayMs = this.restartDelayMs(restartAttempt);
          this.logger.debug(
            `[scrcpy:${options.udid}:${options.sessionId}] restarting display stream after setup failure: ${this.errorMessage(error)}; delayMs=${delayMs}`,
          );
          this.sendJson(options.client, {
            type: "reconnecting",
            message: "Reconnecting live display...",
          });
          await this.delay(delayMs);
        }
      }
    } finally {
      this.streamingSessions.delete(options.sessionId);
      if (this.streamClients.get(options.sessionId) === options.client) {
        this.streamClients.delete(options.sessionId);
      }
    }
  }

  closeSession(sessionId: string) {
    this.streamClients
      .get(sessionId)
      ?.close?.(1000, "Display session released");
    this.streamClients.delete(sessionId);
  }

  private async streamRawVideoAttempt(
    options: ScrcpyStreamOptions,
    registerStop: (stop: () => Promise<void>) => void,
  ): Promise<ScrcpyAttemptResult> {
    if (SCRCPY_TUNNEL_MODE === "forward") {
      return this.streamRawVideoAttemptWithTunnel(
        options,
        registerStop,
        "forward",
      );
    }

    const modes: ScrcpyTunnelMode[] =
      SCRCPY_TUNNEL_MODE === "reverse"
        ? ["reverse", "direct", "forward"]
        : ["direct", "forward"];
    let lastError: unknown;

    for (const mode of modes) {
      try {
        return await this.streamRawVideoAttemptWithTunnel(
          options,
          registerStop,
          mode,
        );
      } catch (error) {
        lastError = error;
        if (
          options.client.readyState !== SCRCPY_WS_OPEN ||
          mode === modes[modes.length - 1]
        ) {
          throw error;
        }

        this.logger.debug(
          `[scrcpy:${options.udid}:${options.sessionId}] ${mode} tunnel failed, falling back to next tunnel: ${this.errorMessage(error)}`,
        );
      }
    }

    throw lastError;
  }

  private async streamRawVideoAttemptWithTunnel(
    options: ScrcpyStreamOptions,
    registerStop: (stop: () => Promise<void>) => void,
    tunnelMode: ScrcpyTunnelMode,
  ): Promise<ScrcpyAttemptResult> {
    const scid = this.createScid();
    const socketName = `scrcpy_${scid}`;
    let localPort = 0;
    const logPrefix = `scrcpy:${options.udid}:${scid}`;
    let reverseAcceptor: ReverseSocketAcceptor | null = null;
    let directConnection: DirectAdbConnection | null = null;
    let serverLaunch: ScrcpyServerLaunch | null = null;
    let streamSocket: ScrcpySocket | null = null;
    let audioSocket: ScrcpySocket | null = null;
    let controlSocket: ScrcpySocket | null = null;
    let bytesForwarded = 0;
    const startedAt = Date.now();
    let forwardActive = false;
    let reverseActive = false;
    let released = false;
    let resolveAttempt: ((result: ScrcpyAttemptResult) => void) | null = null;
    let launcherFailure: Error | null = null;

    const cleanup = async (reason = "display stream stopped") => {
      if (released) {
        return;
      }
      released = true;

      this.logger.debug(
        `[${logPrefix}] closing scrcpy attempt: ${reason}; bytes=${bytesForwarded}; durationMs=${Date.now() - startedAt}; clientState=${options.client.readyState}`,
      );

      if (this.shouldCollectDeviceDiagnostics(reason)) {
        this.runInBackground(
          this.maybeLogDeviceDiagnostics(options.udid, logPrefix, reason),
          `[${logPrefix}] device diagnostics`,
        );
      }

      streamSocket?.destroy();
      audioSocket?.destroy();
      controlSocket?.destroy();
      directConnection?.destroy();
      this.controlSockets.delete(options.sessionId);
      if (options.client.readyState !== SCRCPY_WS_OPEN) {
        this.queuedControlMessages.delete(options.sessionId);
      }
      serverLaunch?.process.kill("SIGTERM");
      if (serverLaunch?.detached) {
        this.runInBackground(
          this.stopDetachedServer(options.udid, scid, logPrefix),
          `[${logPrefix}] detached server cleanup`,
        );
      }

      if (forwardActive) {
        try {
          await this.adb.removeForward(options.udid, localPort);
        } catch (error) {
          this.logger.debug(
            `[${logPrefix}] adb forward cleanup skipped: ${this.errorMessage(error)}`,
          );
        }
      }

      if (reverseActive) {
        try {
          await this.adb.removeReverse(
            options.udid,
            `localabstract:${socketName}`,
          );
        } catch (error) {
          this.logger.debug(
            `[${logPrefix}] adb reverse cleanup skipped: ${this.errorMessage(error)}`,
          );
        }
      }

      await reverseAcceptor?.close();

      resolveAttempt?.({
        reason,
        durationMs: Date.now() - startedAt,
        bytesForwarded,
      });
    };

    try {
      await this.adb.ensureConnected(options.udid);
      await this.adb.pushFile(
        options.udid,
        this.config.scrcpyServerPath,
        "/data/local/tmp/rebroid-scrcpy-server.jar",
      );
      if (tunnelMode === "reverse") {
        reverseAcceptor = await this.createReverseSocketAcceptor();
        localPort = reverseAcceptor.port;
        await this.adb.reverse(
          options.udid,
          `localabstract:${socketName}`,
          `tcp:${localPort}`,
        );
        reverseActive = true;
      } else if (tunnelMode === "forward") {
        localPort = await this.getAvailablePort();
        await this.adb.forward(
          options.udid,
          localPort,
          `localabstract:${socketName}`,
        );
        forwardActive = true;
      }

      serverLaunch = this.startServer(options, scid, socketName, tunnelMode);
      this.pipeServerLogs(serverLaunch.process, logPrefix);
      if (serverLaunch.detached) {
        serverLaunch.process.once("close", (code, signal) => {
          if (!code) {
            return;
          }

          const reason = `display server launcher exited with code ${code}${signal ? ` signal ${signal}` : ""}`;
          launcherFailure = new Error(reason);
          this.runInBackground(
            this.maybeLogDeviceDiagnostics(options.udid, logPrefix, reason),
            `[${logPrefix}] launcher diagnostics`,
          );
          if (resolveAttempt && !released) {
            this.runInBackground(cleanup(reason), `[${logPrefix}] cleanup`);
          }
        });
      }
      if (tunnelMode === "direct") {
        directConnection = await this.connectToDirectAdbConnection(
          options.udid,
          logPrefix,
        );
      }

      const connectedVideo =
        tunnelMode === "reverse"
          ? {
              socket: await reverseAcceptor!.acceptSocket(
                REVERSE_SOCKET_ACCEPT_TIMEOUT_MS,
              ),
              initialPayload: Buffer.alloc(0),
            }
          : tunnelMode === "direct"
            ? await this.connectToDirectAdbVideoSocket(
                directConnection!,
                socketName,
                () => launcherFailure,
              )
            : await this.connectToForwardedVideoSocket(
                localPort,
                () => launcherFailure,
              );
      streamSocket = connectedVideo.socket;
      if (options.audio) {
        audioSocket =
          tunnelMode === "reverse"
            ? await reverseAcceptor!.acceptSocket(
                REVERSE_SOCKET_ACCEPT_TIMEOUT_MS,
              )
            : tunnelMode === "direct"
              ? await this.connectToDirectAdbSocket(
                  directConnection!,
                  socketName,
                  "audio",
                )
              : await this.connectToForwardedSocket(localPort);
      }
      if (SCRCPY_CONTROL_CHANNEL) {
        controlSocket =
          tunnelMode === "reverse"
            ? await reverseAcceptor!.acceptSocket(
                REVERSE_SOCKET_ACCEPT_TIMEOUT_MS,
              )
            : tunnelMode === "direct"
              ? await this.connectToDirectAdbSocket(
                  directConnection!,
                  socketName,
                  "control",
                )
              : await this.connectToForwardedSocket(localPort);
        controlSocket.setNoDelay(true);
        controlSocket.on("data", () => undefined);
      }

      if (forwardActive) {
        await this.adb.removeForward(options.udid, localPort).catch((error) => {
          this.logger.debug(
            `[${logPrefix}] adb forward cleanup skipped after connect: ${this.errorMessage(error)}`,
          );
        });
        forwardActive = false;
      }
      if (reverseActive) {
        await this.adb
          .removeReverse(options.udid, `localabstract:${socketName}`)
          .catch((error) => {
            this.logger.debug(
              `[${logPrefix}] adb reverse cleanup skipped after connect: ${this.errorMessage(error)}`,
            );
          });
        reverseActive = false;
      }
      await reverseAcceptor?.close();
      reverseAcceptor = null;

      if (controlSocket) {
        this.controlSockets.set(options.sessionId, {
          socket: controlSocket,
          udid: options.udid,
        });
        this.flushQueuedControlMessages(options.sessionId);
      }
      options.onActivity?.();

      this.sendJson(options.client, {
        type: "ready",
        adapter: "scrcpy-server-v4-raw",
        codec: options.codec,
        sessionId: options.sessionId,
        udid: options.udid,
      });

      const forwardVideoPayload = (chunk: Buffer) => {
        options.onActivity?.();
        if (!chunk.length) {
          return;
        }
        if (options.client.readyState === SCRCPY_WS_OPEN) {
          bytesForwarded += chunk.byteLength;
          if (options.client.bufferedAmount > WS_HIGH_WATERMARK_BYTES) {
            streamSocket?.pause();
          }

          options.client.send(chunk, { binary: true }, (error?: Error) => {
            if (error) {
              this.runInBackground(
                cleanup(`display websocket send failed: ${error.message}`),
                `[${logPrefix}] websocket cleanup`,
              );
              return;
            }

            if (
              streamSocket &&
              !streamSocket.destroyed &&
              options.client.readyState === SCRCPY_WS_OPEN &&
              options.client.bufferedAmount < WS_LOW_WATERMARK_BYTES
            ) {
              streamSocket.resume();
            }
          });
        }
      };
      const forwardAudioPayload = (packet: ScrcpyAudioPacket) => {
        options.onActivity?.();
        if (options.client.readyState !== SCRCPY_WS_OPEN) {
          return;
        }
        bytesForwarded += packet.data.byteLength;
        if (options.client.bufferedAmount > WS_HIGH_WATERMARK_BYTES) {
          audioSocket?.pause();
        }
        const done = (error?: Error) => {
          if (error) {
            this.runInBackground(
              cleanup(`display audio send failed: ${error.message}`),
              `[${logPrefix}] audio cleanup`,
            );
            return;
          }
          if (
            audioSocket &&
            !audioSocket.destroyed &&
            options.client.readyState === SCRCPY_WS_OPEN &&
            options.client.bufferedAmount < WS_LOW_WATERMARK_BYTES
          ) {
            audioSocket.resume();
          }
        };
        if (options.client.sendAudio) {
          options.client.sendAudio(packet, done);
          return;
        }
        options.client.send(
          this.websocketAudioPacket(packet),
          { binary: true },
          done,
        );
      };

      this.logger.log(
        `[${logPrefix}] streaming ${options.codec}${options.audio ? " + opus" : ""} via ${tunnelMode} tunnel at maxSize=${options.maxSize}, maxFps=${options.maxFps}, bitrate=${options.bitrate}`,
      );

      return await new Promise<ScrcpyAttemptResult>((resolve) => {
        resolveAttempt = resolve;
        registerStop(cleanup);

        if (options.audio) {
          const videoParser = new ScrcpyPacketParser(
            options.codec === "h265" ? SCRCPY_CODEC_H265 : SCRCPY_CODEC_H264,
            true,
            (packet) => forwardVideoPayload(packet.data),
          );
          const audioParser = new ScrcpyPacketParser(
            SCRCPY_CODEC_OPUS,
            false,
            forwardAudioPayload,
            () => {
              this.logger.debug(
                `[${logPrefix}] Android audio capture is unavailable; continuing with video only`,
              );
              this.sendJson(options.client, { type: "audio-disabled" });
              audioSocket?.destroy();
            },
          );
          videoParser.push(connectedVideo.initialPayload);
          streamSocket?.on("data", (chunk: Buffer) => {
            try {
              videoParser.push(chunk);
            } catch (error) {
              this.runInBackground(
                cleanup(`invalid video stream: ${this.errorMessage(error)}`),
                `[${logPrefix}] video parser cleanup`,
              );
            }
          });
          audioSocket?.on("data", (chunk: Buffer) => {
            try {
              audioParser.push(chunk);
            } catch (error) {
              this.runInBackground(
                cleanup(`invalid audio stream: ${this.errorMessage(error)}`),
                `[${logPrefix}] audio parser cleanup`,
              );
            }
          });
          audioSocket?.resume();
        } else {
          forwardVideoPayload(connectedVideo.initialPayload);
          streamSocket?.on("data", forwardVideoPayload);
        }
        streamSocket?.resume();
        let controlReadBuffer = Buffer.alloc(0);
        controlSocket?.on("data", (chunk: Buffer) => {
          controlReadBuffer = this.forwardDeviceControlMessages(
            options.client,
            options.sessionId,
            controlReadBuffer,
            chunk,
          );
        });

        streamSocket?.once("close", () => {
          this.runInBackground(
            cleanup("display stream socket closed"),
            `[${logPrefix}] stream socket close cleanup`,
          );
        });
        streamSocket?.once("error", (error) => {
          this.runInBackground(
            cleanup(`display stream socket failed: ${error.message}`),
            `[${logPrefix}] stream socket error cleanup`,
          );
        });
        audioSocket?.once("error", (error) => {
          this.logger.debug(
            `[${logPrefix}] audio stream socket failed: ${error.message}`,
          );
        });
        controlSocket?.once("close", () => {
          this.runInBackground(
            cleanup("display control socket closed"),
            `[${logPrefix}] control socket close cleanup`,
          );
        });
        controlSocket?.once("error", (error) => {
          this.runInBackground(
            cleanup(`display control socket failed: ${error.message}`),
            `[${logPrefix}] control socket error cleanup`,
          );
        });
        if (!serverLaunch?.detached) {
          serverLaunch?.process.once("close", (code, signal) => {
            if (!released) {
              const reason = `display server exited with code ${code ?? 0}${signal ? ` signal ${signal}` : ""}`;
              this.runInBackground(
                this.maybeLogDeviceDiagnostics(options.udid, logPrefix, reason),
                `[${logPrefix}] server exit diagnostics`,
              );
              this.runInBackground(cleanup(reason), `[${logPrefix}] cleanup`);
            }
          });
        }
      });
    } catch (error) {
      await cleanup(this.errorMessage(error));
      throw error;
    }
  }

  hasActiveControl(sessionId: string) {
    const active = this.controlSockets.get(sessionId);
    return Boolean(active && !active.socket.destroyed);
  }

  usesStreamControl() {
    return SCRCPY_CONTROL_CHANNEL;
  }

  isStreamingSession(sessionId: string) {
    return this.streamingSessions.has(sessionId);
  }

  sendViewerAction(sessionId: string, command: ViewerCommand) {
    const payloads = this.controlCodec.viewerActionPayloads(command);
    return payloads ? this.writeControlMessages(sessionId, payloads) : false;
  }

  sendKeyboardEvent(sessionId: string, event: ScrcpyKeyboardEventPayload) {
    const payloads = this.controlCodec.keyboardEventPayloads(event);
    return payloads ? this.writeControlMessages(sessionId, payloads) : true;
  }

  sendTouchEvent(sessionId: string, event: ScrcpyTouchEventPayload) {
    const payloads = this.controlCodec.touchEventPayloads(event);
    return payloads ? this.writeControlMessages(sessionId, payloads) : false;
  }

  sendClipboard(sessionId: string, text: string) {
    return this.writeControlMessages(sessionId, [
      this.controlCodec.clipboardPayload(text),
    ]);
  }

  private startServer(
    options: ScrcpyStreamOptions,
    scid: string,
    socketName: string,
    tunnelMode: ScrcpyTunnelMode,
  ): ScrcpyServerLaunch {
    const serverOptions = [
      this.config.scrcpyVersion,
      `scid=${scid}`,
      `log_level=${SCRCPY_SERVER_LOG_LEVEL}`,
      "video=true",
      `audio=${options.audio ? "true" : "false"}`,
      "audio_codec=opus",
      `control=${SCRCPY_CONTROL_CHANNEL ? "true" : "false"}`,
      "clipboard_autosync=true",
      "cleanup=false",
      "keep_active=true",
      "power_on=true",
      "raw_stream=true",
      "send_device_meta=false",
      `send_frame_meta=${options.audio ? "true" : "false"}`,
      `send_dummy_byte=${tunnelMode === "reverse" ? "false" : "true"}`,
      `send_stream_meta=${options.audio ? "true" : "false"}`,
      `max_size=${options.maxSize}`,
      `video_bit_rate=${options.bitrate}`,
      `max_fps=${options.maxFps}`,
      `video_codec=${options.codec}`,
    ];

    if (tunnelMode !== "reverse") {
      serverOptions.push("tunnel_forward=true");
    }

    if (options.iFrameInterval && options.iFrameInterval > 0) {
      serverOptions.push(
        `video_codec_options=i-frame-interval:int=${options.iFrameInterval}`,
      );
    }

    const serverClasspath = "/data/local/tmp/rebroid-scrcpy-server.jar";
    const serverCommand = [
      "app_process",
      "/",
      "com.genymobile.scrcpy.Server",
      ...serverOptions,
    ];

    const detached = this.shouldLaunchDetached(tunnelMode);
    if (detached) {
      const innerCommand = [
        `CLASSPATH=${this.shellQuote(serverClasspath)}`,
        ...serverCommand.map((part) => this.shellQuote(part)),
      ].join(" ");
      const launcher = `trap '' HUP; ${innerCommand} </dev/null >/dev/null 2>&1 &`;
      const command = ["-s", options.udid, "shell", launcher];
      this.logger.debug(
        `[scrcpy:${options.udid}:${socketName}] ${command.join(" ")}`,
      );
      return {
        process: this.adb.spawnAdb(command),
        detached: true,
      };
    }

    const command = [
      "-s",
      options.udid,
      "shell",
      `CLASSPATH=${serverClasspath}`,
      ...serverCommand,
    ];

    this.logger.debug(
      `[scrcpy:${options.udid}:${socketName}] ${command.join(" ")}`,
    );
    return {
      process: this.adb.spawnAdb(command),
      detached: false,
    };
  }

  private shouldLaunchDetached(tunnelMode: ScrcpyTunnelMode) {
    if (SCRCPY_SERVER_LAUNCH_MODE === "shell") {
      return false;
    }
    if (SCRCPY_SERVER_LAUNCH_MODE === "detached") {
      return true;
    }
    return tunnelMode !== "reverse";
  }

  private async stopDetachedServer(
    udid: string,
    scid: string,
    logPrefix: string,
  ) {
    try {
      await this.adb.shell(
        udid,
        [
          "sh",
          "-c",
          `pkill -f ${this.shellQuote(`com.genymobile.scrcpy.Server.*scid=${scid}`)} >/dev/null 2>&1 || true`,
        ],
        3_000,
      );
    } catch (error) {
      this.logger.debug(
        `[${logPrefix}] detached scrcpy cleanup skipped: ${this.errorMessage(error)}`,
      );
    }
  }

  private pipeServerLogs(child: AdbChildProcess, logPrefix: string) {
    child.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) {
          this.logger.debug(`[${logPrefix}] ${line}`);
        }
      }
    });

    child.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) {
          this.logger.debug(`[${logPrefix}] ${line}`);
        }
      }
    });
  }

  private connectToForwardedVideoSocket(
    port: number,
    shouldAbort: () => Error | null = () => null,
  ) {
    const startedAt = Date.now();

    return new Promise<ForwardedVideoSocket>((resolve, reject) => {
      const tryConnect = () => {
        const abortError = shouldAbort();
        if (abortError) {
          reject(abortError);
          return;
        }

        const socket = new Socket();
        let settled = false;

        const fail = (error?: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          socket.destroy();

          if (Date.now() - startedAt >= SOCKET_CONNECT_TIMEOUT_MS) {
            reject(
              error ??
                new Error(
                  `Timed out connecting to scrcpy socket on ${LOCALHOST}:${port}`,
                ),
            );
            return;
          }

          setTimeout(tryConnect, 100);
        };

        socket.once("data", (chunk: Buffer) => {
          if (settled) {
            return;
          }
          settled = true;
          socket.setTimeout(0);
          resolve({
            socket,
            // scrcpy writes one dummy byte once the Android local socket is really accepted.
            initialPayload: chunk.subarray(1),
          });
        });
        socket.once("close", () =>
          fail(
            new Error(
              `scrcpy socket closed before handshake on ${LOCALHOST}:${port}`,
            ),
          ),
        );
        socket.once("error", fail);
        socket.setTimeout(1_000, () =>
          fail(
            new Error(
              `Timed out connecting to scrcpy socket on ${LOCALHOST}:${port}`,
            ),
          ),
        );
        socket.connect(port, LOCALHOST);
      };

      tryConnect();
    });
  }

  private connectToForwardedSocket(port: number) {
    const startedAt = Date.now();

    return new Promise<Socket>((resolve, reject) => {
      const tryConnect = () => {
        const socket = new Socket();
        let settled = false;

        const fail = (error?: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          socket.destroy();

          if (Date.now() - startedAt >= SOCKET_CONNECT_TIMEOUT_MS) {
            reject(
              error ??
                new Error(
                  `Timed out connecting to scrcpy socket on ${LOCALHOST}:${port}`,
                ),
            );
            return;
          }

          setTimeout(tryConnect, 100);
        };

        socket.once("connect", () => {
          if (settled) {
            return;
          }
          settled = true;
          socket.setTimeout(0);
          resolve(socket);
        });
        socket.once("close", () =>
          fail(
            new Error(
              `scrcpy socket closed before connect on ${LOCALHOST}:${port}`,
            ),
          ),
        );
        socket.once("error", fail);
        socket.setTimeout(1_000, () =>
          fail(
            new Error(
              `Timed out connecting to scrcpy socket on ${LOCALHOST}:${port}`,
            ),
          ),
        );
        socket.connect(port, LOCALHOST);
      };

      tryConnect();
    });
  }

  private async connectToDirectAdbVideoSocket(
    connection: DirectAdbConnection,
    socketName: string,
    shouldAbort: () => Error | null = () => null,
  ): Promise<ForwardedVideoSocket> {
    const startedAt = Date.now();
    let lastError: unknown;

    while (Date.now() - startedAt < SOCKET_CONNECT_TIMEOUT_MS) {
      const abortError = shouldAbort();
      if (abortError) {
        throw abortError;
      }

      const socket = await this.connectToDirectAdbSocket(
        connection,
        socketName,
        "video",
      ).catch((error) => {
        lastError = error;
        return null;
      });
      if (!socket) {
        await this.delay(SCRCPY_CONNECT_RETRY_DELAY_MS);
        continue;
      }

      const connected = await this.readDirectDummyByte(
        socket,
        socketName,
      ).catch((error) => {
        lastError = error;
        socket.destroy();
        return null;
      });
      if (connected) {
        return connected;
      }

      await this.delay(SCRCPY_CONNECT_RETRY_DELAY_MS);
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          `Timed out connecting ADB local socket localabstract:${socketName}`,
        );
  }

  private readDirectDummyByte(
    socket: ScrcpySocket,
    socketName: string,
  ): Promise<ForwardedVideoSocket> {
    socket.pause();

    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        cleanup();
        queueMicrotask(() => socket.pause());
        resolve({
          socket,
          initialPayload: chunk.subarray(1),
        });
      };
      const onClose = () => {
        cleanup();
        reject(
          new Error(
            `scrcpy direct socket closed before handshake for ${socketName}`,
          ),
        );
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timed out waiting for scrcpy direct socket handshake for ${socketName}`,
          ),
        );
      }, SOCKET_CONNECT_TIMEOUT_MS);
      const cleanup = () => {
        clearTimeout(timer);
        socket.removeListener?.("data", onData);
        socket.removeListener?.("close", onClose);
        socket.removeListener?.("error", onError);
      };

      socket.once("data", onData);
      socket.once("close", onClose);
      socket.once("error", onError);
      socket.resume();
    });
  }

  private connectToDirectAdbConnection(udid: string, logPrefix?: string) {
    const target = this.parseTcpAdbTarget(udid);
    if (!target) {
      throw new Error(
        `Direct ADB transport requires a TCP ADB target, got ${udid}`,
      );
    }

    return new DirectAdbConnection((message) => {
      if (logPrefix) {
        this.logger.debug(`[${logPrefix}] ${message}`);
      }
    }).connect(target.host, target.port);
  }

  private connectToDirectAdbSocket(
    connection: DirectAdbConnection,
    socketName: string,
    label: string,
  ): Promise<ScrcpySocket> {
    return connection
      .open(`localabstract:${socketName}`, label)
      .then((connected) => connected.setNoDelay(true));
  }

  private parseTcpAdbTarget(udid: string) {
    const index = udid.lastIndexOf(":");
    if (index <= 0) {
      return null;
    }

    const port = Number(udid.slice(index + 1));
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      return null;
    }

    return {
      host: udid.slice(0, index),
      port,
    };
  }

  private createReverseSocketAcceptor() {
    return new Promise<ReverseSocketAcceptor>((resolve, reject) => {
      const server: Server = createServer();
      const accepted: Socket[] = [];
      const waiters: Array<{
        resolve: (socket: Socket) => void;
        reject: (error: Error) => void;
      }> = [];

      const rejectWaiters = (error: Error) => {
        while (waiters.length) {
          waiters.shift()!.reject(error);
        }
      };

      server.on("connection", (socket) => {
        const waiter = waiters.shift();
        if (waiter) {
          waiter.resolve(socket);
          return;
        }
        accepted.push(socket);
      });
      server.once("error", (error) => {
        rejectWaiters(error);
        reject(error);
      });
      server.listen(0, LOCALHOST, () => {
        const address = server.address();
        const port =
          typeof address === "object" && address ? address.port : null;
        if (!port) {
          reject(new Error("Could not allocate a reverse tunnel TCP port."));
          return;
        }

        resolve({
          port,
          acceptSocket: (timeoutMs = SOCKET_CONNECT_TIMEOUT_MS) =>
            new Promise<Socket>((acceptResolve, acceptReject) => {
              const socket = accepted.shift();
              if (socket) {
                acceptResolve(socket);
                return;
              }

              const waiter = {
                resolve: acceptResolve,
                reject: acceptReject,
              };
              waiters.push(waiter);
              setTimeout(() => {
                const index = waiters.indexOf(waiter);
                if (index >= 0) {
                  waiters.splice(index, 1);
                  acceptReject(
                    new Error(
                      `Timed out waiting for scrcpy reverse socket on ${LOCALHOST}:${port}`,
                    ),
                  );
                }
              }, timeoutMs);
            }),
          close: () =>
            new Promise<void>((closeResolve) => {
              rejectWaiters(new Error("scrcpy reverse socket acceptor closed"));
              for (const socket of accepted.splice(0)) {
                socket.destroy();
              }
              server.close(() => closeResolve());
            }),
        });
      });
    });
  }

  private getAvailablePort() {
    return new Promise<number>((resolve, reject) => {
      const server: Server = createServer();
      server.once("error", reject);
      server.listen(0, LOCALHOST, () => {
        const address = server.address();
        const port =
          typeof address === "object" && address ? address.port : null;
        server.close(() => {
          if (!port) {
            reject(new Error("Could not allocate a local TCP port."));
            return;
          }
          resolve(port);
        });
      });
    });
  }

  private createScid() {
    return Math.floor(Math.random() * 0x7fffffff)
      .toString(16)
      .padStart(8, "0");
  }

  private sendJson(client: ScrcpyStreamClient, payload: unknown) {
    if (client.readyState === SCRCPY_WS_OPEN) {
      client.send(JSON.stringify(payload));
    }
  }

  private websocketAudioPacket(packet: ScrcpyAudioPacket) {
    const header = Buffer.alloc(AUDIO_PACKET_HEADER_BYTES);
    AUDIO_PACKET_MAGIC.copy(header);
    header[AUDIO_PACKET_MAGIC.length] = packet.config ? 1 : 0;
    header.writeBigInt64BE(packet.timestampUs, AUDIO_PACKET_MAGIC.length + 1);
    return Buffer.concat([header, packet.data]);
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private runInBackground(
    operation: Promise<unknown> | undefined,
    description: string,
  ) {
    void operation?.catch((error) => {
      this.logger.warn(
        `${description} failed: ${this.errorMessage(error)}`,
      );
    });
  }

  private restartDelayMs(attempt: number) {
    return Math.min(
      STREAM_RESTART_BACKOFF_MS * 2 ** Math.min(Math.max(attempt - 1, 0), 4),
      5_000,
    );
  }

  private nextEffectiveStreamOptions(
    options: ScrcpyStreamOptions,
    result: ScrcpyAttemptResult,
  ): ScrcpyStreamOptions {
    if (options.audio && result.reason === AUDIO_CONFIGURATION_FAILURE_REASON) {
      return { ...options, audio: false };
    }

    const shortAndroidStreamExit =
      result.reason.startsWith("display server exited with code 0") ||
      result.reason === "display stream socket closed" ||
      result.reason === "display control socket closed";

    if (
      !shortAndroidStreamExit ||
      result.durationMs > SCRCPY_CLEAN_EXIT_DOWNGRADE_MS
    ) {
      return options;
    }

    const next = {
      ...options,
      bitrate: Math.min(options.bitrate, SCRCPY_STABLE_BITRATE),
      maxFps: Math.min(options.maxFps, SCRCPY_STABLE_MAX_FPS),
      maxSize:
        options.maxSize === 0
          ? SCRCPY_STABLE_MAX_SIZE
          : Math.min(options.maxSize, SCRCPY_STABLE_MAX_SIZE),
      iFrameInterval:
        options.iFrameInterval && options.iFrameInterval > 0
          ? Math.max(options.iFrameInterval, SCRCPY_STABLE_I_FRAME_INTERVAL)
          : SCRCPY_STABLE_I_FRAME_INTERVAL,
    };

    if (
      next.bitrate !== options.bitrate ||
      next.maxFps !== options.maxFps ||
      next.maxSize !== options.maxSize ||
      next.iFrameInterval !== options.iFrameInterval
    ) {
      this.logger.warn(
        `[scrcpy:${options.udid}:${options.sessionId}] Android display encoder exited after ${result.durationMs}ms; retrying with stable stream settings maxSize=${next.maxSize}, maxFps=${next.maxFps}, bitrate=${next.bitrate}, iFrameInterval=${next.iFrameInterval}`,
      );
      return next;
    }

    return options;
  }

  private async maybeLogDeviceDiagnostics(
    udid: string,
    logPrefix: string,
    reason: string,
  ) {
    if (!SCRCPY_LOGCAT_ON_SERVER_EXIT) {
      return;
    }

    const now = Date.now();
    const last = this.lastLogcatDiagnosticsAt.get(udid) ?? 0;
    if (now - last < SCRCPY_LOGCAT_INTERVAL_MS) {
      return;
    }
    this.lastLogcatDiagnosticsAt.set(udid, now);

    try {
      const result = await this.adb.logcat(udid, 350);
      const diagnosticPattern =
        /scrcpy|MediaCodec|ACodec|CCodec|OMX|SoftAVC|VirtualDisplay|BufferQueue|Surface|surfaceflinger|gralloc|ashmem|RenderEngine|hwservicemanager|adbd/i;
      const lines = result.stdout
        .split(/\r?\n/)
        .filter((line) => diagnosticPattern.test(line))
        .slice(-80);

      if (!lines.length) {
        this.logger.debug(
          `[${logPrefix}] no relevant device logcat lines after ${reason}`,
        );
        return;
      }

      this.logger.debug(
        `[${logPrefix}] recent device diagnostics after ${reason}:\n${lines.map((line) => `[logcat] ${line}`).join("\n")}`,
      );
    } catch (error) {
      this.logger.debug(
        `[${logPrefix}] could not collect device diagnostics after ${reason}: ${this.errorMessage(error)}`,
      );
    }
  }

  private shouldCollectDeviceDiagnostics(reason: string) {
    return (
      reason.startsWith("display server exited") ||
      reason.startsWith("display server launcher exited") ||
      reason.includes("display stream socket") ||
      reason.includes("display control socket")
    );
  }

  private writeControlMessages(sessionId: string, payloads: Buffer[]) {
    const active = this.controlSockets.get(sessionId);
    if (active && !active.socket.destroyed && active.socket.writable) {
      try {
        for (const payload of payloads) {
          active.socket.write(payload);
        }
        return true;
      } catch (error) {
        this.logger.debug(
          `[scrcpy:${active.udid}:${sessionId}] could not write control message: ${this.errorMessage(error)}`,
        );
      }
    }

    if (!SCRCPY_CONTROL_CHANNEL) {
      return false;
    }

    if (!this.streamingSessions.has(sessionId)) {
      return false;
    }

    this.enqueueControlMessages(sessionId, payloads);
    return true;
  }

  private forwardDeviceControlMessages(
    client: ScrcpyStreamClient,
    sessionId: string,
    pending: Buffer,
    chunk: Buffer,
  ) {
    let buffer = Buffer.concat([pending, chunk]);

    while (buffer.length > 0) {
      const type = buffer.readUInt8(0);

      if (type === DEVICE_MESSAGE_CLIPBOARD) {
        if (buffer.length < 5) {
          return buffer;
        }

        const length = buffer.readUInt32BE(1);
        if (buffer.length < 5 + length) {
          return buffer;
        }

        const text = buffer.subarray(5, 5 + length).toString("utf8");
        buffer = buffer.subarray(5 + length);
        this.sendJson(client, {
          type: "clipboard",
          sessionId,
          text,
        });
        continue;
      }

      if (type === DEVICE_MESSAGE_ACK_CLIPBOARD) {
        if (buffer.length < 9) {
          return buffer;
        }

        buffer = buffer.subarray(9);
        continue;
      }

      this.logger.debug(
        `[scrcpy:${sessionId}] unsupported device control message ${type}; dropping ${buffer.length} bytes`,
      );
      return Buffer.alloc(0);
    }

    return buffer;
  }

  private enqueueControlMessages(sessionId: string, payloads: Buffer[]) {
    const now = Date.now();
    const queue = (this.queuedControlMessages.get(sessionId) ?? []).filter(
      (message) => now - message.queuedAt <= MAX_QUEUED_CONTROL_AGE_MS,
    );
    queue.push({ payloads, queuedAt: now });
    while (queue.length > MAX_QUEUED_CONTROL_MESSAGES) {
      queue.shift();
    }
    this.queuedControlMessages.set(sessionId, queue);
  }

  private flushQueuedControlMessages(sessionId: string) {
    const queued = this.queuedControlMessages.get(sessionId);
    if (!queued?.length) {
      return;
    }

    const active = this.controlSockets.get(sessionId);
    if (!active || active.socket.destroyed || !active.socket.writable) {
      return;
    }

    this.queuedControlMessages.delete(sessionId);
    const now = Date.now();
    let flushed = 0;
    for (const message of queued) {
      if (now - message.queuedAt > MAX_QUEUED_CONTROL_AGE_MS) {
        continue;
      }

      for (const payload of message.payloads) {
        active.socket.write(payload);
      }
      flushed += 1;
    }

    if (flushed > 0) {
      this.logger.debug(
        `[scrcpy:${active.udid}:${sessionId}] flushed ${flushed} queued control messages`,
      );
    }
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
