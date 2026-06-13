import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { createServer, Server, Socket } from "node:net";
import { AdbService } from "../adb/adb.service";
import type { AdbChildProcess } from "../adb/adb.service";
import { type ViewerCommand } from "@rebroid/application-core/viewer-control";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DirectAdbConnection } from "./direct-adb-connection";
import { H264Mp4Recorder } from "./h264-mp4-recorder";
import { ScrcpyControlCodec } from "./scrcpy-control-codec";
import {
  SCRCPY_CODEC_H264,
  SCRCPY_CODEC_H265,
  SCRCPY_CODEC_OPUS,
  ScrcpyPacketParser,
} from "./scrcpy-packet-parser";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpyStreamLiveness } from "./scrcpy-stream-liveness";
import {
  ForwardedVideoSocket,
  SCRCPY_WS_OPEN,
  ScrcpyAudioPacket,
  ScrcpyAttemptResult,
  ScrcpyCompatibilityMode,
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
const REVERSE_SOCKET_ACCEPT_TIMEOUT_MS = 5_000;
const AUXILIARY_SOCKET_CONNECT_TIMEOUT_MS = 2_000;
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
const AUDIO_PACKET_MAGIC = Buffer.from("RA01");
const AUDIO_PACKET_HEADER_BYTES = AUDIO_PACKET_MAGIC.length + 1 + 8;
const AUDIO_CONFIGURATION_FAILURE_REASON =
  "invalid audio stream: scrcpy stream configuration failed on the device";
const MINIMUM_SCRCPY_SERVER_MAJOR = 4;
const MAX_SUPPORTED_ANDROID_SDK = 34;
const SCRCPY_RECORDING_MP4_TIMESCALE = 90_000;
const COMPATIBILITY_PROBE_LOGCAT_LINES = 220;
const COMPATIBILITY_PROBE_PROPERTIES = [
  "ro.build.version.release",
  "ro.build.version.sdk",
  "ro.product.brand",
  "ro.product.model",
  "ro.build.id",
  "ro.redroid.version",
  "ro.build.flavor",
] as const;
const COMPATIBILITY_PROBE_SERVICES = [
  "input",
  "settings",
  "display",
  "SurfaceFlinger",
] as const;
const DISPLAY_DIAGNOSTIC_PATTERN =
  /scrcpy|MediaCodec|ACodec|CCodec|OMX|SoftAVC|VirtualDisplay|BufferQueue|Surface|surfaceflinger|gralloc|ashmem|RenderEngine|hwservicemanager|adbd|InputManagerGlobal|KeyCharacterMap|IDisplayWindowListener|Can't find service/i;

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

interface ScrcpyCompatibilityProbe {
  androidRelease: string;
  androidSdk: number | null;
  productBrand: string;
  productModel: string;
  buildId: string;
  redroidVersion: string;
  services: Record<
    (typeof COMPATIBILITY_PROBE_SERVICES)[number],
    "found" | "missing" | "unknown"
  >;
  encoders: string[];
  diagnostics: string[];
}

interface ActiveRecording {
  id: string;
  sessionId: string;
  startedAt: string;
  fileName: string;
  recorder: H264Mp4Recorder;
}

interface CompletedRecording {
  id: string;
  sessionId: string;
  startedAt: string;
  stoppedAt: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  sampleCount: number;
  data: Buffer;
}

@Injectable()
export class ScrcpyService {
  private readonly logger = new Logger(ScrcpyService.name);
  private readonly controlCodec = new ScrcpyControlCodec();
  private readonly controlSockets = new Map<string, ActiveControlSocket>();
  private readonly streamingSessions = new Set<string>();
  private readonly streamClients = new Map<string, ScrcpyStreamClient>();
  private readonly controlUnavailableSessions = new Set<string>();
  private readonly queuedControlMessages = new Map<
    string,
    QueuedControlMessage[]
  >();
  private readonly lastLogcatDiagnosticsAt = new Map<string, number>();
  private readonly activeRecordings = new Map<string, ActiveRecording>();
  private readonly completedRecordings = new Map<string, CompletedRecording>();
  private readonly scrcpyServerPushes = new Set<string>();

  constructor(
    private readonly adb: AdbService,
    private readonly config: SidecarConfigService,
  ) {}

  async streamRawVideo(options: ScrcpyStreamOptions) {
    let clientClosed = false;
    let stopCurrentAttempt: (() => Promise<void>) | null = null;
    let streamedOnce = false;
    let restartAttempt = 0;
    let effectiveOptions: ScrcpyStreamOptions = {
      ...options,
      control: options.control ?? true,
      compatibilityMode: options.compatibilityMode ?? "normal",
    };
    this.assertCompatibleScrcpyServerVersion();
    const previousClient = this.streamClients.get(options.sessionId);
    if (previousClient && previousClient !== options.client) {
      previousClient.close?.(1012, "Display stream replaced");
    }
    this.streamingSessions.add(options.sessionId);
    this.streamClients.set(options.sessionId, options.client);
    const compatibilityProbe = await this.collectCompatibilityProbe(
      options.udid,
      `scrcpy:${options.udid}:${options.sessionId}`,
    );
    this.assertSupportedAndroidVersion(compatibilityProbe);
    this.sendCompatibilityStatus(options.client, effectiveOptions, {
      message: this.compatibilityProbeSummary(compatibilityProbe),
    });

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
          const previousOptions = effectiveOptions;
          effectiveOptions = this.nextEffectiveStreamOptions(
            effectiveOptions,
            result,
          );
          if (this.compatibilityStateChanged(previousOptions, effectiveOptions)) {
            this.sendCompatibilityStatus(options.client, effectiveOptions);
          }
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
            const diagnostics = await this.collectCompatibilityProbe(
              options.udid,
              `scrcpy:${options.udid}:${options.sessionId}`,
            ).catch(() => compatibilityProbe);
            const nextOptions =
              this.nextInitialSetupStreamOptions(
                effectiveOptions,
                error,
                diagnostics,
              );
            if (nextOptions !== effectiveOptions) {
              const audioWasEnabled = effectiveOptions.audio;
              const controlWasEnabled = effectiveOptions.control !== false;
              effectiveOptions = nextOptions;
              restartAttempt += 1;
              const delayMs = this.restartDelayMs(restartAttempt);
              this.logger.debug(
                `[scrcpy:${options.udid}:${options.sessionId}] initial display stream setup failed: ${this.errorMessage(error)}; retrying with ${this.retryDescription(effectiveOptions, audioWasEnabled, controlWasEnabled)}; delayMs=${delayMs}`,
              );
              if (audioWasEnabled && !effectiveOptions.audio) {
                this.sendJson(options.client, { type: "audio-disabled" });
              }
              this.sendCompatibilityStatus(options.client, effectiveOptions, {
                message: this.compatibilityProbeSummary(diagnostics),
                diagnostic: this.firstDiagnosticLine(diagnostics),
              });
              this.sendJson(options.client, {
                type: "reconnecting",
                message: this.reconnectMessage(effectiveOptions, error),
                diagnostic: this.firstDiagnosticLine(diagnostics),
              });
              await this.delay(delayMs);
              continue;
            }
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
    this.finishRecordingForSession(sessionId);
  }

  serverVersion() {
    return this.config.scrcpyVersion;
  }

  startRecording(sessionId: string, displayName = "display") {
    const existing = this.activeRecordings.get(sessionId);
    if (existing) {
      return this.recordingMetadata(existing);
    }

    const startedAt = new Date().toISOString();
    const id = `${sessionId}-${Date.now().toString(36)}`;
    const fileName = `${this.safeFileSegment(displayName)}-${startedAt.replace(/[:.]/g, "-")}.mp4`;
    const recording: ActiveRecording = {
      id,
      sessionId,
      startedAt,
      fileName,
      recorder: new H264Mp4Recorder(
        Math.max(1, Math.round(SCRCPY_RECORDING_MP4_TIMESCALE / 30)),
      ),
    };
    this.activeRecordings.set(sessionId, recording);
    return this.recordingMetadata(recording);
  }

  stopRecording(sessionId: string) {
    const recording = this.activeRecordings.get(sessionId);
    if (!recording) {
      throw new ConflictException("Display recording is not active.");
    }

    try {
      return this.completeRecording(recording);
    } catch (error) {
      throw new ConflictException(this.errorMessage(error));
    }
  }

  listRecordings(sessionId: string) {
    return [
      ...[this.activeRecordings.get(sessionId)]
        .filter((recording): recording is ActiveRecording => Boolean(recording))
        .map((recording) => this.recordingMetadata(recording)),
      ...[...this.completedRecordings.values()]
        .filter((recording) => recording.sessionId === sessionId)
        .map((recording) => this.recordingMetadata(recording)),
    ];
  }

  getRecording(recordingId: string) {
    return this.completedRecordings.get(recordingId) ?? null;
  }

  async assertTargetSupported(udid: string) {
    this.assertCompatibleScrcpyServerVersion();
    this.assertSupportedAndroidVersion(
      await this.collectCompatibilityProbe(udid, `scrcpy:${udid}:support`),
    );
  }

  private recordVideoPacket(sessionId: string, packet: ScrcpyPacket) {
    const recording = this.activeRecordings.get(sessionId);
    if (!recording) {
      return;
    }

    recording.recorder.addPacket(packet.data, packet.timestampUs);
  }

  private finishRecordingForSession(sessionId: string) {
    const recording = this.activeRecordings.get(sessionId);
    if (!recording) {
      return null;
    }

    try {
      return this.completeRecording(recording);
    } catch (error) {
      this.logger.warn(
        `[scrcpy:${sessionId}] dropping unfinished recording: ${this.errorMessage(error)}`,
      );
      this.activeRecordings.delete(sessionId);
      return null;
    }
  }

  private completeRecording(recording: ActiveRecording) {
    const data = recording.recorder.finish();
    const stoppedAt = new Date().toISOString();
    const completed: CompletedRecording = {
      id: recording.id,
      sessionId: recording.sessionId,
      startedAt: recording.startedAt,
      stoppedAt,
      fileName: recording.fileName,
      mimeType: "video/mp4",
      sizeBytes: data.length,
      durationMs: recording.recorder.durationMs,
      sampleCount: recording.recorder.sampleCount,
      data,
    };
    this.activeRecordings.delete(recording.sessionId);
    this.completedRecordings.set(recording.id, completed);
    return this.recordingMetadata(completed);
  }

  private recordingMetadata(recording: ActiveRecording | CompletedRecording) {
    const completed = "data" in recording;
    return {
      id: recording.id,
      sessionId: recording.sessionId,
      status: completed ? ("stopped" as const) : ("recording" as const),
      startedAt: recording.startedAt,
      stoppedAt: completed ? recording.stoppedAt : null,
      fileName: recording.fileName,
      mimeType: "video/mp4",
      sizeBytes: completed ? recording.sizeBytes : 0,
      durationMs: completed ? recording.durationMs : 0,
      sampleCount: completed ? recording.sampleCount : 0,
      downloadPath: completed
        ? `/rebroid/display/recordings/${encodeURIComponent(recording.id)}`
        : null,
    };
  }

  private safeFileSegment(value: string) {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "display"
    );
  }

  private async streamRawVideoAttempt(
    options: ScrcpyStreamOptions,
    registerStop: (stop: () => Promise<void>) => void,
  ): Promise<ScrcpyAttemptResult> {
    if (
      SCRCPY_TUNNEL_MODE === "reverse" ||
      SCRCPY_TUNNEL_MODE === "direct" ||
      SCRCPY_TUNNEL_MODE === "forward"
    ) {
      return this.streamRawVideoAttemptWithTunnel(
        options,
        registerStop,
        SCRCPY_TUNNEL_MODE,
      );
    }

    // Preserve the known-good startup path. Reverse tunneling changes scrcpy
    // server/socket timing enough to break some Redroid starts, so it remains
    // an explicit SCRCPY_TUNNEL_MODE=reverse override rather than auto-first.
    const modes: ScrcpyTunnelMode[] = ["direct", "forward"];
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
    let liveness: ScrcpyStreamLiveness | null = null;
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
      liveness?.stop();
      liveness = null;
      directConnection?.destroy();
      this.controlSockets.delete(options.sessionId);
      this.controlUnavailableSessions.delete(options.sessionId);
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
      this.controlUnavailableSessions.delete(options.sessionId);
      await this.adb.ensureConnected(options.udid);
      await this.ensureScrcpyServerPushed(options.udid);
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
        audioSocket = await this.connectOptionalSocket(
          logPrefix,
          "audio",
          async () =>
            tunnelMode === "reverse"
              ? await reverseAcceptor!.acceptSocket(
                  REVERSE_SOCKET_ACCEPT_TIMEOUT_MS,
                )
              : tunnelMode === "direct"
                ? await this.connectToDirectAdbSocket(
                    directConnection!,
                    socketName,
                    "audio",
                    AUXILIARY_SOCKET_CONNECT_TIMEOUT_MS,
                  )
                : await this.connectToForwardedSocket(
                    localPort,
                    AUXILIARY_SOCKET_CONNECT_TIMEOUT_MS,
                  ),
        );
      }
      if (this.streamControlEnabled(options)) {
        controlSocket = await this.connectOptionalSocket(
          logPrefix,
          "control",
          async () =>
            tunnelMode === "reverse"
              ? await reverseAcceptor!.acceptSocket(
                  REVERSE_SOCKET_ACCEPT_TIMEOUT_MS,
                )
              : tunnelMode === "direct"
                ? await this.connectToDirectAdbSocket(
                    directConnection!,
                    socketName,
                    "control",
                    AUXILIARY_SOCKET_CONNECT_TIMEOUT_MS,
                  )
                : await this.connectToForwardedSocket(
                    localPort,
                    AUXILIARY_SOCKET_CONNECT_TIMEOUT_MS,
                  ),
        );
        if (controlSocket) {
          controlSocket.setNoDelay(true);
          controlSocket.on("data", () => undefined);
        } else {
          this.controlUnavailableSessions.add(options.sessionId);
          this.queuedControlMessages.delete(options.sessionId);
        }
      } else if (SCRCPY_CONTROL_CHANNEL) {
        this.controlUnavailableSessions.add(options.sessionId);
        this.queuedControlMessages.delete(options.sessionId);
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
      if (options.audio && !audioSocket) {
        this.sendJson(options.client, { type: "audio-disabled" });
      }
      options.onActivity?.();

      this.sendJson(options.client, {
        type: "ready",
        adapter: "scrcpy-server-v4-raw",
        codec: options.codec,
        sessionId: options.sessionId,
        udid: options.udid,
      });

      const forwardVideoPayload = (packet: ScrcpyPacket) => {
        options.onActivity?.();
        liveness?.recordVideoPacket(packet);
        const chunk = packet.data;
        if (!chunk.length) {
          return;
        }
        this.recordVideoPacket(options.sessionId, packet);
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
        liveness = new ScrcpyStreamLiveness({
          onTimeout: (reason) => {
            this.runInBackground(cleanup(reason), `[${logPrefix}] cleanup`);
          },
        });
        liveness.start();

        if (options.audio) {
          const videoParser = new ScrcpyPacketParser({
            expectedCodec:
              options.codec === "h265" ? SCRCPY_CODEC_H265 : SCRCPY_CODEC_H264,
            allowSessionPackets: true,
            onPacket: forwardVideoPayload,
          });
          const audioParser = audioSocket
            ? new ScrcpyPacketParser({
                expectedCodec: SCRCPY_CODEC_OPUS,
                allowSessionPackets: false,
                onPacket: forwardAudioPayload,
                onDisabled: () => {
                  this.logger.debug(
                    `[${logPrefix}] Android audio capture is unavailable; continuing with video only`,
                  );
                  this.sendJson(options.client, { type: "audio-disabled" });
                  audioSocket?.destroy();
                },
              })
            : null;
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
              audioParser?.push(chunk);
            } catch (error) {
              this.runInBackground(
                cleanup(`invalid audio stream: ${this.errorMessage(error)}`),
                `[${logPrefix}] audio parser cleanup`,
              );
            }
          });
          audioSocket?.resume();
        } else {
          const videoParser = new ScrcpyPacketParser({
            expectedCodec:
              options.codec === "h265" ? SCRCPY_CODEC_H265 : SCRCPY_CODEC_H264,
            allowSessionPackets: true,
            onPacket: forwardVideoPayload,
          });
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
          if (released) {
            return;
          }
          this.controlSockets.delete(options.sessionId);
          this.controlUnavailableSessions.add(options.sessionId);
          this.queuedControlMessages.delete(options.sessionId);
          this.logger.debug(
            `[${logPrefix}] display control socket closed; continuing video with ADB control fallback`,
          );
        });
        controlSocket?.once("error", (error) => {
          if (released) {
            return;
          }
          this.controlSockets.delete(options.sessionId);
          this.controlUnavailableSessions.add(options.sessionId);
          this.queuedControlMessages.delete(options.sessionId);
          this.logger.debug(
            `[${logPrefix}] display control socket failed: ${error.message}; continuing video with ADB control fallback`,
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

  shouldWaitForStreamControl(sessionId: string) {
    return (
      SCRCPY_CONTROL_CHANNEL &&
      this.streamingSessions.has(sessionId) &&
      !this.controlUnavailableSessions.has(sessionId)
    );
  }

  private streamControlEnabled(options: ScrcpyStreamOptions) {
    return SCRCPY_CONTROL_CHANNEL && options.control !== false;
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
      `control=${this.streamControlEnabled(options) ? "true" : "false"}`,
      "clipboard_autosync=true",
      "cleanup=false",
      "keep_active=true",
      "power_on=true",
      "send_device_meta=false",
      "send_frame_meta=true",
      `send_dummy_byte=${tunnelMode === "reverse" ? "false" : "true"}`,
      "send_stream_meta=true",
      `max_size=${options.maxSize}`,
      `video_bit_rate=${options.bitrate}`,
      `max_fps=${options.maxFps}`,
      `video_codec=${options.codec}`,
    ];

    if (options.newDisplay) {
      serverOptions.push(
        `new_display=${options.newDisplay.width}x${options.newDisplay.height}/${options.newDisplay.dpi}`,
        "vd_destroy_content=false",
      );
    } else if (options.displayId !== undefined) {
      serverOptions.push(`display_id=${options.displayId}`);
    }

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

  private async ensureScrcpyServerPushed(udid: string) {
    const key = `${udid}:${this.config.scrcpyVersion}:${this.config.scrcpyServerPath}`;
    const remotePath = "/data/local/tmp/rebroid-scrcpy-server.jar";
    if (this.scrcpyServerPushes.has(key)) {
      const stillPresent = await this.adb
        .fileExists(udid, remotePath)
        .catch(() => false);
      if (stillPresent) {
        return;
      }
      this.scrcpyServerPushes.delete(key);
    }

    await this.adb.pushFile(udid, this.config.scrcpyServerPath, remotePath);
    this.scrcpyServerPushes.add(key);
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

  private connectToForwardedSocket(
    port: number,
    timeoutMs = SOCKET_CONNECT_TIMEOUT_MS,
  ) {
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

          if (Date.now() - startedAt >= timeoutMs) {
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
        socket.setTimeout(Math.min(1_000, timeoutMs), () =>
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

  private async connectOptionalSocket(
    logPrefix: string,
    label: string,
    connect: () => Promise<ScrcpySocket>,
  ) {
    try {
      return await connect();
    } catch (error) {
      this.logger.debug(
        `[${logPrefix}] scrcpy ${label} socket unavailable; continuing without ${label}: ${this.errorMessage(error)}`,
      );
      return null;
    }
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
    timeoutMs = SOCKET_CONNECT_TIMEOUT_MS,
  ): Promise<ScrcpySocket> {
    return connection
      .open(`localabstract:${socketName}`, label, timeoutMs)
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

  private nextInitialSetupStreamOptions(
    options: ScrcpyStreamOptions,
    error: unknown,
    probe: ScrcpyCompatibilityProbe | null,
  ): ScrcpyStreamOptions {
    if (options.audio) {
      return {
        ...options,
        audio: false,
        compatibilityMode: "audio-disabled",
      };
    }

    if (
      options.control !== false &&
      this.shouldRetryWithoutStreamControl(error, probe)
    ) {
      return {
        ...options,
        control: false,
        compatibilityMode: "stream-control-disabled",
      };
    }

    const next = this.stableStreamOptions(options);
    return this.sameStreamSettings(options, next) ? options : next;
  }

  private nextEffectiveStreamOptions(
    options: ScrcpyStreamOptions,
    result: ScrcpyAttemptResult,
  ): ScrcpyStreamOptions {
    if (options.audio && result.reason === AUDIO_CONFIGURATION_FAILURE_REASON) {
      return {
        ...options,
        audio: false,
        compatibilityMode: "audio-disabled",
      };
    }

    const shortAndroidStreamExit =
      result.reason.startsWith("display server exited with code 0") ||
      result.reason === "display stream socket closed" ||
      result.reason === "display control socket closed" ||
      result.reason === "display stream first keyframe timed out" ||
      result.reason === "display stream video progress timed out";

    if (
      !shortAndroidStreamExit ||
      result.durationMs > SCRCPY_CLEAN_EXIT_DOWNGRADE_MS
    ) {
      return options;
    }

    const next = this.stableStreamOptions(options);

    if (!this.sameStreamSettings(options, next)) {
      this.logger.warn(
        `[scrcpy:${options.udid}:${options.sessionId}] Android display encoder exited after ${result.durationMs}ms; retrying with stable stream settings maxSize=${next.maxSize}, maxFps=${next.maxFps}, bitrate=${next.bitrate}, iFrameInterval=${next.iFrameInterval}`,
      );
      return next;
    }

    return options;
  }

  private stableStreamOptions(options: ScrcpyStreamOptions): ScrcpyStreamOptions {
    return {
      ...options,
      compatibilityMode: "stable-video",
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
  }

  private sameStreamSettings(
    left: ScrcpyStreamOptions,
    right: ScrcpyStreamOptions,
  ) {
    return (
      left.bitrate === right.bitrate &&
      left.maxFps === right.maxFps &&
      left.maxSize === right.maxSize &&
      left.iFrameInterval === right.iFrameInterval
    );
  }

  private compatibilityStateChanged(
    previous: ScrcpyStreamOptions,
    next: ScrcpyStreamOptions,
  ) {
    return (
      previous.compatibilityMode !== next.compatibilityMode ||
      previous.audio !== next.audio ||
      previous.control !== next.control
    );
  }

  private assertCompatibleScrcpyServerVersion() {
    const version = this.config.scrcpyVersion.trim();
    const major = Number(version.split(".")[0]);
    if (!Number.isFinite(major) || major < MINIMUM_SCRCPY_SERVER_MAJOR) {
      throw new Error(
        `Display sidecar bundles scrcpy server ${version}; Rebroid display streaming requires scrcpy ${MINIMUM_SCRCPY_SERVER_MAJOR}.0 or newer.`,
      );
    }
  }

  private assertSupportedAndroidVersion(
    probe: ScrcpyCompatibilityProbe | null,
  ) {
    if (!probe?.androidSdk || probe.androidSdk <= MAX_SUPPORTED_ANDROID_SDK) {
      return;
    }

    throw new Error(
      `Redroid Android ${probe.androidRelease || probe.androidSdk} is not supported by Rebroid display streaming yet. Use a Redroid 13 or 14 image for live display access.`,
    );
  }

  private async collectCompatibilityProbe(
    udid: string,
    logPrefix: string,
  ): Promise<ScrcpyCompatibilityProbe | null> {
    try {
      const [probeResult, logcatResult] = await Promise.allSettled([
        this.adb.shell(
          udid,
          [
            "sh",
            "-lc",
            [
              'echo "== props =="',
              COMPATIBILITY_PROBE_PROPERTIES
                .map(
                  (prop) =>
                    `printf '${prop}='; getprop ${prop} 2>/dev/null || true; printf '\\n'`,
                )
                .join("; "),
              'echo "== services =="',
              `for svc in ${COMPATIBILITY_PROBE_SERVICES.join(" ")}; do if service check "$svc" 2>/dev/null | grep -qi found; then echo "$svc=found"; else echo "$svc=missing"; fi; done`,
              'echo "== encoders =="',
              'cmd media.codec list 2>/dev/null | grep -Ei "encoder|avc|hevc|h264|h265" | head -80 || dumpsys media.codec 2>/dev/null | grep -Ei "encoder|avc|hevc|h264|h265" | head -80 || true',
            ].join("; "),
          ],
          8_000,
        ),
        this.adb.logcat(udid, COMPATIBILITY_PROBE_LOGCAT_LINES),
      ]);

      const output =
        probeResult.status === "fulfilled" ? probeResult.value.stdout : "";
      const logcat =
        logcatResult.status === "fulfilled" ? logcatResult.value.stdout : "";
      const probe = this.parseCompatibilityProbe(output, logcat);
      this.logger.debug(
        `[${logPrefix}] Android display compatibility probe: ${this.compatibilityProbeSummary(probe)}`,
      );
      const diagnostic = this.firstDiagnosticLine(probe);
      if (diagnostic) {
        this.logger.debug(`[${logPrefix}] diagnostic: ${diagnostic}`);
      }
      return probe;
    } catch (error) {
      this.logger.debug(
        `[${logPrefix}] compatibility probe skipped: ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private parseCompatibilityProbe(
    output: string,
    logcat: string,
  ): ScrcpyCompatibilityProbe {
    const props = new Map<string, string>();
    const services = Object.fromEntries(
      COMPATIBILITY_PROBE_SERVICES.map((service) => [service, "unknown"]),
    ) as ScrcpyCompatibilityProbe["services"];
    const encoders: string[] = [];
    let section = "";

    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }
      if (line === "== props ==" || line === "== services ==" || line === "== encoders ==") {
        section = line;
        continue;
      }
      if (section === "== props ==") {
        const separator = line.indexOf("=");
        if (separator > 0) {
          props.set(line.slice(0, separator), line.slice(separator + 1));
        }
        continue;
      }
      if (section === "== services ==") {
        const separator = line.indexOf("=");
        const name = line.slice(0, separator);
        const status = line.slice(separator + 1);
        if (separator > 0 && this.isCompatibilityService(name)) {
          services[name] = status === "found" ? "found" : "missing";
        }
        continue;
      }
      if (section === "== encoders ==" && encoders.length < 80) {
        encoders.push(line);
      }
    }

    const diagnostics = logcat
      .split(/\r?\n/)
      .filter((line) => DISPLAY_DIAGNOSTIC_PATTERN.test(line))
      .slice(-40);

    const sdk = Number(props.get("ro.build.version.sdk"));
    return {
      androidRelease: props.get("ro.build.version.release") ?? "",
      androidSdk: Number.isFinite(sdk) ? sdk : null,
      productBrand: props.get("ro.product.brand") ?? "",
      productModel: props.get("ro.product.model") ?? "",
      buildId: props.get("ro.build.id") ?? "",
      redroidVersion: props.get("ro.redroid.version") ?? "",
      services,
      encoders,
      diagnostics,
    };
  }

  private isCompatibilityService(
    value: string,
  ): value is (typeof COMPATIBILITY_PROBE_SERVICES)[number] {
    return COMPATIBILITY_PROBE_SERVICES.some((service) => service === value);
  }

  private shouldRetryWithoutStreamControl(
    error: unknown,
    probe: ScrcpyCompatibilityProbe | null,
  ) {
    const message = this.errorMessage(error);
    const diagnostics = probe?.diagnostics.join("\n") ?? "";
    const text = `${message}\n${diagnostics}`;
    const androidSdk = probe?.androidSdk ?? 0;
    const mayBeAndroid15OrNewer = !probe || androidSdk >= 35;
    const redroidLike =
      /redroid/i.test(
        `${probe?.productBrand ?? ""} ${probe?.productModel ?? ""} ${probe?.redroidVersion ?? ""}`,
      ) || !probe;

    return (
      redroidLike &&
      mayBeAndroid15OrNewer &&
      /InputManagerGlobal|getInputDevice|KeyCharacterMap|Can't find service: settings|Can't find service: input|control|Timed out connecting to scrcpy socket/i.test(
        text,
      )
    );
  }

  private sendCompatibilityStatus(
    client: ScrcpyStreamClient,
    options: ScrcpyStreamOptions,
    details: { message?: string; diagnostic?: string } = {},
  ) {
    this.sendJson(client, {
      type: "compatibility",
      mode: options.compatibilityMode ?? "normal",
      control: this.streamControlEnabled(options),
      audio: options.audio,
      message: details.message ?? this.compatibilityModeMessage(options),
      diagnostic: details.diagnostic,
    });
  }

  private compatibilityModeMessage(options: ScrcpyStreamOptions) {
    const mode = options.compatibilityMode ?? "normal";
    if (mode === "audio-disabled") {
      return "Audio capture is disabled for this stream after Android rejected the audio setup.";
    }
    if (mode === "stream-control-disabled") {
      return "Stream control is disabled for this Android build; viewer controls use ADB fallback.";
    }
    if (mode === "stable-video") {
      return "Using conservative video settings after the Android encoder exited early.";
    }
    return "Using the standard scrcpy display stream.";
  }

  private reconnectMessage(options: ScrcpyStreamOptions, error: unknown) {
    const mode = options.compatibilityMode ?? "normal";
    if (mode === "stream-control-disabled") {
      return "Retrying live display without scrcpy stream control...";
    }
    if (mode === "audio-disabled") {
      return "Retrying live display without Android audio capture...";
    }
    if (mode === "stable-video") {
      return "Retrying live display with stable video settings...";
    }
    return `Reconnecting live display: ${this.errorMessage(error)}`;
  }

  private retryDescription(
    options: ScrcpyStreamOptions,
    audioWasEnabled: boolean,
    controlWasEnabled: boolean,
  ) {
    if (audioWasEnabled && !options.audio) {
      return "video only";
    }
    if (controlWasEnabled && options.control === false) {
      return "ADB control fallback";
    }
    return `stable stream settings maxSize=${options.maxSize}, maxFps=${options.maxFps}, bitrate=${options.bitrate}, iFrameInterval=${options.iFrameInterval}`;
  }

  private compatibilityProbeSummary(probe: ScrcpyCompatibilityProbe | null) {
    if (!probe) {
      return "Android compatibility diagnostics were unavailable.";
    }
    const version = [probe.androidRelease, probe.androidSdk && `API ${probe.androidSdk}`]
      .filter(Boolean)
      .join(" ");
    const services = Object.entries(probe.services)
      .map(([name, status]) => `${name}:${status}`)
      .join(" ");
    return [
      version || "Android version unknown",
      [probe.productBrand, probe.productModel].filter(Boolean).join(" ") ||
        "unknown device",
      probe.buildId ? `build ${probe.buildId}` : null,
      services,
    ]
      .filter(Boolean)
      .join("; ");
  }

  private firstDiagnosticLine(probe: ScrcpyCompatibilityProbe | null) {
    return probe?.diagnostics.at(-1)?.slice(0, 260);
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
      const lines = result.stdout
        .split(/\r?\n/)
        .filter((line) => DISPLAY_DIAGNOSTIC_PATTERN.test(line))
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
      reason.includes("display stream first keyframe") ||
      reason.includes("display stream video progress") ||
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

    if (this.controlUnavailableSessions.has(sessionId)) {
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
