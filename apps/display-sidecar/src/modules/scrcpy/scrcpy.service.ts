import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { createServer, Server, Socket } from "node:net";
import { AdbService } from "../adb/adb.service";
import type { AdbChildProcess } from "../adb/adb.service";
import { type ViewerCommand } from "@rebroid/android-application-core/viewer-control";
import { SidecarConfigService } from "../shared/sidecar-config.service";
import { DirectAdbConnection } from "./direct-adb-connection";
import { ScrcpyControlCodec } from "./scrcpy-control-codec";
import {
  compatibilityStateChanged,
  compatibilityProbeServices,
  displayDiagnosticPattern,
  parseCompatibilityProbe,
  selectInitialRetryStreamOptions,
  selectRestartStreamOptions,
  type ScrcpyCompatibilityProbe,
} from "./scrcpy-compatibility";
import {
  SCRCPY_CODEC_H264,
  SCRCPY_CODEC_OPUS,
  ScrcpyPacketParser,
} from "./scrcpy-packet-parser";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpyStreamLiveness } from "./scrcpy-stream-liveness";
import { ScrcpyStreamSessionRegistry } from "./scrcpy-stream-session-registry";
import { ScrcpySourceStream } from "./scrcpy-source-stream";
import { ScrcpyVideoPacketForwarder } from "./scrcpy-video-packet-forwarder";
import {
  ForwardedVideoSocket,
  ScrcpyAudioPacket,
  ScrcpyAttemptResult,
  ScrcpyCompatibilityMode,
  ScrcpyMediaSink,
  ScrcpySocket,
  ScrcpyStreamAttachment,
  ScrcpyStreamOptions,
  ScrcpyTunnelMode,
} from "./scrcpy.types";
import type {
  KeyboardControlPayload,
  TouchControlPayload,
} from "../shared/display-control.types";

const LOCALHOST = "127.0.0.1";
const SOCKET_CONNECT_TIMEOUT_MS = 10_000;
const STREAM_RESTART_BACKOFF_MS = 500;
const STREAM_HEARTBEAT_INTERVAL_MS = 5_000;
const SCRCPY_CONNECT_RETRY_DELAY_MS = 100;
const REVERSE_SOCKET_ACCEPT_TIMEOUT_MS = 5_000;
const AUXILIARY_SOCKET_CONNECT_TIMEOUT_MS = 2_000;
const MAX_QUEUED_CONTROL_MESSAGES = 128;
const MAX_QUEUED_CONTROL_AGE_MS = 10_000;
const SCRCPY_LOGCAT_INTERVAL_MS = 10_000;
const DEVICE_MESSAGE_CLIPBOARD = 0;
const DEVICE_MESSAGE_ACK_CLIPBOARD = 1;
const MINIMUM_SCRCPY_SERVER_MAJOR = 4;
const MAX_SUPPORTED_ANDROID_SDK = 34;
const COMPATIBILITY_PROBE_LOGCAT_LINES = 220;
const SOURCE_IDLE_GRACE_MS = 30_000;
const VIDEO_RESET_MIN_INTERVAL_MS = 1_000;
const VIDEO_RESET_WATCHDOG_MS = 3_000;
const SCRCPY_CONTROL_RESET_VIDEO = 17;
const COMPATIBILITY_PROBE_PROPERTIES = [
  "ro.build.version.release",
  "ro.build.version.sdk",
  "ro.product.brand",
  "ro.product.model",
  "ro.build.id",
  "ro.redroid.version",
  "ro.build.flavor",
] as const;
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

interface ActiveScrcpySource {
  profileKey: string;
  stream: ScrcpySourceStream;
  idleTimer: NodeJS.Timeout | null;
  resetTimer: NodeJS.Timeout | null;
  resetWatchdog: NodeJS.Timeout | null;
  resetPending: boolean;
  resetReason: string;
  resetGeneration: number;
  resetCount: number;
  resetSawConfig: boolean;
  resetSawKeyFrame: boolean;
  lastResetAt: number;
  restartAttempt: (() => Promise<void>) | null;
}


@Injectable()
export class ScrcpyService implements OnModuleDestroy {
  private readonly logger = new Logger(ScrcpyService.name);
  private readonly controlCodec = new ScrcpyControlCodec();
  private readonly controlSockets = new Map<string, ActiveControlSocket>();
  private readonly streamingSessions = new Set<string>();
  private readonly controlUnavailableSessions = new Set<string>();
  private readonly queuedControlMessages = new Map<
    string,
    QueuedControlMessage[]
  >();
  private readonly lastLogcatDiagnosticsAt = new Map<string, number>();
  private readonly scrcpyServerPushes = new Set<string>();
  private readonly streamSessions = new ScrcpyStreamSessionRegistry();
  private readonly sources = new Map<string, ActiveScrcpySource>();

  constructor(
    private readonly adb: AdbService,
    private readonly config: SidecarConfigService,
  ) {}

  attachStream(options: ScrcpyStreamOptions): ScrcpyStreamAttachment {
    this.assertCompatibleScrcpyServerVersion();
    const profileKey = this.streamProfileKey(options);
    let source = this.sources.get(options.sessionId);
    if (source && source.profileKey !== profileKey) {
      this.closeSource(
        options.sessionId,
        1012,
        "Display encoder profile changed",
      );
      source = undefined;
    }

    if (!source) {
      const stream = new ScrcpySourceStream(
        () => this.armSourceIdleTimer(options.sessionId),
        () => this.cancelSourceIdleTimer(options.sessionId),
        (reason) => this.requestVideoReset(options.sessionId, reason),
      );
      source = {
        profileKey,
        stream,
        idleTimer: null,
        resetTimer: null,
        resetWatchdog: null,
        resetPending: false,
        resetReason: "",
        resetGeneration: 0,
        resetCount: 0,
        resetSawConfig: false,
        resetSawKeyFrame: false,
        lastResetAt: 0,
        restartAttempt: null,
      };
      this.sources.set(options.sessionId, source);
      const sourceOptions: ScrcpyStreamOptions = {
        ...options,
        sink: stream,
        onActivity: () => {
          if (stream.consumerCount() > 0) {
            options.onActivity?.();
          }
        },
      };
      void this.runSource(sourceOptions, source)
        .then(() => {
          if (this.sources.get(options.sessionId) === source) {
            this.closeSource(
              options.sessionId,
              1011,
              "scrcpy source stopped unexpectedly",
            );
          }
        })
        .catch((error) => {
          if (this.sources.get(options.sessionId) !== source) {
            return;
          }
          this.logger.warn(
            `[scrcpy:${options.udid}:${options.sessionId}] source failed: ${this.errorMessage(error)}`,
          );
          this.closeSource(
            options.sessionId,
            1011,
            this.errorMessage(error).slice(0, 120),
          );
        });
    }

    const attachment = source.stream.attach(options.sink);
    this.requestVideoReset(options.sessionId, "consumer-attached");
    return attachment;
  }

  private async runSource(
    options: ScrcpyStreamOptions,
    source: ActiveScrcpySource,
  ) {
    let clientClosed = false;
    let stopCurrentAttempt: (() => Promise<void>) | null = null;
    let streamedOnce = false;
    let restartAttempt = 0;
    let effectiveOptions = this.streamSessions.beginStream({
      ...options,
      requestedProfile: {
        codec: options.codec,
        maxSize: options.maxSize,
        maxFps: options.maxFps,
        bitrate: options.bitrate,
        iFrameInterval: options.iFrameInterval ?? 1,
        audio: options.audio,
        control: options.control ?? true,
      },
    });
    this.streamingSessions.add(options.sessionId);
    const compatibilityProbe = await this.collectCompatibilityProbe(
      options.udid,
      `scrcpy:${options.udid}:${options.sessionId}`,
    );
    this.assertSupportedAndroidVersion(compatibilityProbe);
    this.sendCompatibilityStatus(options.sink, effectiveOptions, {
      message: this.compatibilityProbeSummary(compatibilityProbe),
    });

    options.sink.onClose((code, reason) => {
      clientClosed = true;
      this.logger.debug(
        `[scrcpy:${options.udid}:${options.sessionId}] stream client closed code=${code ?? "unknown"} reason=${reason?.toString() || ""}`,
      );
      this.runInBackground(
        stopCurrentAttempt?.(),
        `[scrcpy:${options.udid}:${options.sessionId}] client close cleanup`,
      );
    });

    try {
      while (!clientClosed && options.sink.isOpen()) {
        try {
          const result = await this.streamRawVideoAttempt(
            effectiveOptions,
            (stop) => {
              stopCurrentAttempt = stop;
              source.restartAttempt = stop;
            },
          );
          stopCurrentAttempt = null;
          source.restartAttempt = null;

          if (clientClosed || !options.sink.isOpen()) {
            return;
          }

          streamedOnce = true;
          const audioWasEnabled = effectiveOptions.audio;
          const previousOptions = effectiveOptions;
          effectiveOptions = selectRestartStreamOptions(
            effectiveOptions,
            result,
            this.streamSessions.isAudioDisabled(effectiveOptions.sessionId),
          );
          if (audioWasEnabled && !effectiveOptions.audio) {
            this.streamSessions.markAudioDisabled(effectiveOptions.sessionId);
          }
          if (compatibilityStateChanged(previousOptions, effectiveOptions)) {
            this.sendCompatibilityStatus(options.sink, effectiveOptions);
          }
          if (audioWasEnabled && !effectiveOptions.audio) {
            this.logger.debug(
              `[scrcpy:${options.udid}:${options.sessionId}] Android audio configuration failed; retrying with video only`,
            );
            this.sendJson(options.sink, { type: "audio-disabled" });
          }
          restartAttempt = result.durationMs > 30_000 ? 0 : restartAttempt + 1;
          const delayMs = this.restartDelayMs(restartAttempt);
          this.logger.debug(
            `[scrcpy:${options.udid}:${options.sessionId}] restarting display stream after: ${result.reason}; delayMs=${delayMs}`,
          );
          this.sendJson(options.sink, {
            type: "reconnecting",
            message: "Reconnecting live display...",
          });
          await this.delay(delayMs);
        } catch (error) {
          stopCurrentAttempt = null;
          source.restartAttempt = null;

          if (!streamedOnce) {
            const diagnostics = await this.collectCompatibilityProbe(
              options.udid,
              `scrcpy:${options.udid}:${options.sessionId}`,
            ).catch(() => compatibilityProbe);
            const nextOptions = selectInitialRetryStreamOptions(
              effectiveOptions,
              this.errorMessage(error),
              diagnostics,
            );
            if (nextOptions !== effectiveOptions) {
              const audioWasEnabled = effectiveOptions.audio;
              const controlWasEnabled = effectiveOptions.control !== false;
              effectiveOptions = nextOptions;
              if (audioWasEnabled && !effectiveOptions.audio) {
                this.streamSessions.markAudioDisabled(
                  effectiveOptions.sessionId,
                );
              }
              restartAttempt += 1;
              const delayMs = this.restartDelayMs(restartAttempt);
              this.logger.debug(
                `[scrcpy:${options.udid}:${options.sessionId}] initial display stream setup failed: ${this.errorMessage(error)}; retrying with ${this.retryDescription(effectiveOptions, audioWasEnabled, controlWasEnabled)}; delayMs=${delayMs}`,
              );
              if (audioWasEnabled && !effectiveOptions.audio) {
                this.sendJson(options.sink, { type: "audio-disabled" });
              }
              this.sendCompatibilityStatus(options.sink, effectiveOptions, {
                message: this.compatibilityProbeSummary(diagnostics),
                diagnostic: this.firstDiagnosticLine(diagnostics),
              });
              this.sendJson(options.sink, {
                type: "reconnecting",
                message: this.reconnectMessage(effectiveOptions, error),
                diagnostic: this.firstDiagnosticLine(diagnostics),
              });
              await this.delay(delayMs);
              continue;
            }
            throw error;
          }

          if (clientClosed || !options.sink.isOpen()) {
            return;
          }

          restartAttempt += 1;
          const delayMs = this.restartDelayMs(restartAttempt);
          this.logger.debug(
            `[scrcpy:${options.udid}:${options.sessionId}] restarting display stream after setup failure: ${this.errorMessage(error)}; delayMs=${delayMs}`,
          );
          this.sendJson(options.sink, {
            type: "reconnecting",
            message: "Reconnecting live display...",
          });
          await this.delay(delayMs);
        }
      }
    } finally {
      this.streamingSessions.delete(options.sessionId);
      source.restartAttempt = null;
    }
  }

  closeSession(sessionId: string) {
    this.closeSource(sessionId, 1000, "Display session released");
    this.streamSessions.closeSession(sessionId);
  }

  requestVideoReset(sessionId: string, reason: string): boolean {
    const source = this.sources.get(sessionId);
    if (!source || !source.stream.isOpen()) {
      return false;
    }
    source.resetPending = true;
    source.resetReason = reason.slice(0, 120);
    this.scheduleVideoReset(sessionId, source);
    return true;
  }

  onModuleDestroy(): void {
    for (const sessionId of [...this.sources.keys()]) {
      this.closeSource(sessionId, 1001, "Display sidecar shutting down");
    }
  }

  serverVersion() {
    return this.config.scrcpyVersion;
  }

  async assertTargetSupported(udid: string) {
    this.assertCompatibleScrcpyServerVersion();
    this.assertSupportedAndroidVersion(
      await this.collectCompatibilityProbe(udid, `scrcpy:${udid}:support`),
    );
  }

  private async streamRawVideoAttempt(
    options: ScrcpyStreamOptions,
    registerStop: (stop: () => Promise<void>) => void,
  ): Promise<ScrcpyAttemptResult> {
    if (
      this.config.scrcpyTunnelMode === "reverse" ||
      this.config.scrcpyTunnelMode === "direct" ||
      this.config.scrcpyTunnelMode === "forward"
    ) {
      return this.streamRawVideoAttemptWithTunnel(
        options,
        registerStop,
        this.config.scrcpyTunnelMode,
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
          !options.sink.isOpen() ||
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
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let bytesForwarded = 0;
    let videoPacketForwarder: ScrcpyVideoPacketForwarder | null = null;
    const startedAt = Date.now();
    let forwardActive = false;
    let reverseActive = false;
    let released = false;
    let resolveAttempt: ((result: ScrcpyAttemptResult) => void) | null = null;
    let launcherFailure: Error | null = null;
    let actualEncoder =
      this.config.scrcpyVideoEncoder ?? "scrcpy-android-mediacodec";
    this.sources
      .get(options.sessionId)
      ?.stream.setActualEncoder(actualEncoder);

    const cleanup = async (reason = "display stream stopped") => {
      if (released) {
        return;
      }
      released = true;

      const videoStats = videoPacketForwarder?.snapshot() ?? {
        mediaPackets: 0,
        keyFrames: 0,
        configPackets: 0,
      };
      this.logger.debug(
        `[${logPrefix}] closing scrcpy attempt: ${reason}; bytes=${bytesForwarded}; mediaPackets=${videoStats.mediaPackets}; keyframes=${videoStats.keyFrames}; configPackets=${videoStats.configPackets}; durationMs=${Date.now() - startedAt}; sinkOpen=${options.sink.isOpen()}; queues=${JSON.stringify(options.sink.snapshot())}`,
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
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      liveness?.stop();
      liveness = null;
      directConnection?.destroy();
      this.controlSockets.delete(options.sessionId);
      this.controlUnavailableSessions.delete(options.sessionId);
      if (!options.sink.isOpen()) {
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
      this.pipeServerLogs(serverLaunch.process, logPrefix, (line) => {
        const match = line.match(/(?:video\s+)?encoder:\s*([^,;]+)/i);
        if (!match?.[1]) {
          return;
        }
        actualEncoder = match[1].trim().slice(0, 160);
        this.sources
          .get(options.sessionId)
          ?.stream.setActualEncoder(actualEncoder);
        this.sendJson(options.sink, {
          type: "encoder",
          name: actualEncoder,
        });
      });
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
      } else if (this.config.scrcpyControlChannel) {
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
        const activeSource = this.sources.get(options.sessionId);
        if (activeSource) {
          this.scheduleVideoReset(options.sessionId, activeSource);
        }
      }
      if (options.audio && !audioSocket) {
        this.streamSessions.markAudioDisabled(options.sessionId);
        this.sendJson(options.sink, { type: "audio-disabled" });
      }
      options.onActivity?.();

      this.sendJson(options.sink, {
        type: "ready",
        adapter: "scrcpy-server-v4-rbd1",
        protocolVersion: 1,
        codec: options.codec,
        encoder: actualEncoder,
        scrcpyVersion: this.config.scrcpyVersion,
        sessionId: options.sessionId,
        udid: options.udid,
        requestedProfile: options.requestedProfile ?? {
          codec: options.codec,
          maxSize: options.maxSize,
          maxFps: options.maxFps,
          bitrate: options.bitrate,
          iFrameInterval: options.iFrameInterval ?? 1,
          audio: options.audio,
          control: this.streamControlEnabled(options),
        },
        effectiveProfile: {
          codec: options.codec,
          maxSize: options.maxSize,
          maxFps: options.maxFps,
          bitrate: options.bitrate,
          iFrameInterval: options.iFrameInterval ?? 1,
          audio: options.audio,
          control: this.streamControlEnabled(options),
          tunnel: tunnelMode,
        },
        sourceAttemptId:
          this.sources.get(options.sessionId)?.stream.sourceAttemptId,
        encoderResetCount:
          this.sources.get(options.sessionId)?.resetCount ?? 0,
        downgradeReason:
          options.compatibilityMode === "normal"
            ? null
            : options.compatibilityMode,
      });

      heartbeatTimer = setInterval(() => {
        options.onActivity?.();
        this.sendJson(options.sink, { type: "heartbeat" });
      }, STREAM_HEARTBEAT_INTERVAL_MS);
      heartbeatTimer.unref?.();

      videoPacketForwarder = new ScrcpyVideoPacketForwarder();
      const forwardVideoPayload = (packet: ScrcpyPacket) => {
        options.onActivity?.();
        const forwarded = videoPacketForwarder!.accept(packet);
        if (forwarded.firstConfigPacket) {
          this.logger.debug(
            `[${logPrefix}] first video config packet received; bytes=${packet.data.byteLength}`,
          );
        }
        if (!forwarded.packet) {
          return;
        }
        const streamPacket = forwarded.packet;
        const activeSource = this.sources.get(options.sessionId);
        if (activeSource) {
          this.observeVideoReset(activeSource, streamPacket);
        }
        if (forwarded.firstMediaPacket) {
          this.logger.debug(
            `[${logPrefix}] first video media packet received; keyFrame=${streamPacket.keyFrame}; bytes=${streamPacket.data.byteLength}`,
          );
        }
        if (forwarded.firstKeyFrame) {
          this.logger.debug(
            `[${logPrefix}] first video keyframe received; bytes=${streamPacket.data.byteLength}; configPrepended=${forwarded.configPrepended}`,
          );
        }
        if (!streamPacket.config) {
          liveness?.recordVideoPacket(streamPacket);
        }
        const chunk = streamPacket.data;
        if (!chunk.length) {
          return;
        }
        if (options.sink.isOpen()) {
          bytesForwarded += chunk.byteLength;
          options.sink.writeVideo(streamPacket, (error?: Error) => {
            if (error) {
              this.runInBackground(
                cleanup(`display video send failed: ${error.message}`),
                `[${logPrefix}] video sink cleanup`,
              );
            }
          });
        }
      };
      const disableAudio = (reason: string) => {
        if (!audioSocket) {
          return;
        }
        this.streamSessions.markAudioDisabled(options.sessionId);
        this.logger.debug(`[${logPrefix}] ${reason}; continuing video only`);
        this.sendJson(options.sink, { type: "audio-disabled" });
        audioSocket.destroy();
        audioSocket = null;
      };
      const forwardAudioPayload = (packet: ScrcpyAudioPacket) => {
        options.onActivity?.();
        if (!options.sink.isOpen() || !audioSocket) {
          return;
        }
        bytesForwarded += packet.data.byteLength;
        const done = (error?: Error) => {
          if (error) {
            disableAudio(`display audio send failed: ${error.message}`);
            return;
          }
        };
        options.sink.writeAudio(packet, done);
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
              SCRCPY_CODEC_H264,
            allowSessionPackets: true,
            onPacket: forwardVideoPayload,
          });
          const audioParser = audioSocket
            ? new ScrcpyPacketParser({
                expectedCodec: SCRCPY_CODEC_OPUS,
                allowSessionPackets: false,
                onPacket: forwardAudioPayload,
                onDisabled: () => {
                  disableAudio("Android audio capture is unavailable");
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
              disableAudio(`invalid audio stream: ${this.errorMessage(error)}`);
            }
          });
          audioSocket?.resume();
        } else {
          const videoParser = new ScrcpyPacketParser({
            expectedCodec:
              SCRCPY_CODEC_H264,
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
            options.sink,
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
    return this.config.scrcpyControlChannel;
  }

  shouldWaitForStreamControl(sessionId: string) {
    return (
      this.config.scrcpyControlChannel &&
      this.streamingSessions.has(sessionId) &&
      !this.controlUnavailableSessions.has(sessionId)
    );
  }

  private streamControlEnabled(options: ScrcpyStreamOptions) {
    return this.config.scrcpyControlChannel && options.control !== false;
  }

  isStreamingSession(sessionId: string) {
    return this.streamingSessions.has(sessionId);
  }

  sendViewerAction(sessionId: string, command: ViewerCommand) {
    const payloads = this.controlCodec.viewerActionPayloads(command);
    return payloads ? this.writeControlMessages(sessionId, payloads) : false;
  }

  sendKeyboardEvent(sessionId: string, event: KeyboardControlPayload) {
    const payloads = this.controlCodec.keyboardEventPayloads(event);
    return payloads ? this.writeControlMessages(sessionId, payloads) : true;
  }

  sendTouchEvent(sessionId: string, event: TouchControlPayload) {
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
      `log_level=${this.config.scrcpyServerLogLevel}`,
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
    if (this.config.scrcpyVideoEncoder) {
      serverOptions.push(`video_encoder=${this.config.scrcpyVideoEncoder}`);
    }

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
        `video_codec_options=i-frame-interval:int=${options.iFrameInterval},max-bframes:int=0`,
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
    if (this.config.scrcpyServerLaunchMode === "shell") {
      return false;
    }
    if (this.config.scrcpyServerLaunchMode === "detached") {
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

  private pipeServerLogs(
    child: AdbChildProcess,
    logPrefix: string,
    onLine?: (line: string) => void,
  ) {
    child.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) {
          onLine?.(line.trim());
          this.logger.debug(`[${logPrefix}] ${line}`);
        }
      }
    });

    child.stdout.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) {
          onLine?.(line.trim());
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

  private sendJson(sink: ScrcpyMediaSink, payload: unknown) {
    sink.sendStatus(payload);
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
              `for svc in ${compatibilityProbeServices.join(" ")}; do if service check "$svc" 2>/dev/null | grep -qi found; then echo "$svc=found"; else echo "$svc=missing"; fi; done`,
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
      const probe = parseCompatibilityProbe(output, logcat);
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

  private sendCompatibilityStatus(
    sink: ScrcpyMediaSink,
    options: ScrcpyStreamOptions,
    details: { message?: string; diagnostic?: string } = {},
  ) {
    this.sendJson(sink, {
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
    return "the requested video profile";
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
    if (!this.config.scrcpyLogcatOnServerExit) {
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
        .filter((line) => displayDiagnosticPattern.test(line))
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

    if (!this.config.scrcpyControlChannel) {
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
    sink: ScrcpyMediaSink,
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
        this.sendJson(sink, {
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

  private streamProfileKey(options: ScrcpyStreamOptions): string {
    return JSON.stringify({
      udid: options.udid,
      codec: options.codec,
      displayId: options.displayId ?? null,
      newDisplay: options.newDisplay ?? null,
      maxSize: options.maxSize,
      maxFps: options.maxFps,
      bitrate: options.bitrate,
      audio: options.audio,
      control: options.control ?? true,
      iFrameInterval: options.iFrameInterval ?? 1,
    });
  }

  private armSourceIdleTimer(sessionId: string): void {
    const source = this.sources.get(sessionId);
    if (!source || source.idleTimer || source.stream.consumerCount() > 0) {
      return;
    }
    source.idleTimer = setTimeout(() => {
      source.idleTimer = null;
      if (
        this.sources.get(sessionId) === source &&
        source.stream.consumerCount() === 0
      ) {
        this.closeSource(sessionId, 1000, "Display source idle timeout");
      }
    }, SOURCE_IDLE_GRACE_MS);
    source.idleTimer.unref?.();
  }

  private cancelSourceIdleTimer(sessionId: string): void {
    const source = this.sources.get(sessionId);
    if (!source?.idleTimer) {
      return;
    }
    clearTimeout(source.idleTimer);
    source.idleTimer = null;
  }

  private closeSource(sessionId: string, code: number, reason: string): void {
    const source = this.sources.get(sessionId);
    if (!source) {
      return;
    }
    this.sources.delete(sessionId);
    if (source.idleTimer) {
      clearTimeout(source.idleTimer);
    }
    if (source.resetTimer) {
      clearTimeout(source.resetTimer);
    }
    if (source.resetWatchdog) {
      clearTimeout(source.resetWatchdog);
    }
    source.idleTimer = null;
    source.resetTimer = null;
    source.resetWatchdog = null;
    source.stream.close(code, reason);
  }

  private scheduleVideoReset(
    sessionId: string,
    source: ActiveScrcpySource,
  ): void {
    if (
      !source.resetPending ||
      source.resetTimer ||
      this.sources.get(sessionId) !== source
    ) {
      return;
    }
    const active = this.controlSockets.get(sessionId);
    if (!active || active.socket.destroyed || !active.socket.writable) {
      return;
    }
    const waitMs = Math.max(
      0,
      source.lastResetAt + VIDEO_RESET_MIN_INTERVAL_MS - Date.now(),
    );
    if (waitMs > 0) {
      source.resetTimer = setTimeout(() => {
        source.resetTimer = null;
        this.scheduleVideoReset(sessionId, source);
      }, waitMs);
      source.resetTimer.unref?.();
      return;
    }

    try {
      active.socket.write(Buffer.from([SCRCPY_CONTROL_RESET_VIDEO]));
    } catch (error) {
      this.logger.debug(
        `[scrcpy:${active.udid}:${sessionId}] video reset write failed: ${this.errorMessage(error)}`,
      );
      return;
    }

    source.resetPending = false;
    source.lastResetAt = Date.now();
    source.resetCount += 1;
    source.resetGeneration += 1;
    source.resetSawConfig = false;
    source.resetSawKeyFrame = false;
    if (source.resetWatchdog) {
      clearTimeout(source.resetWatchdog);
    }
    const generation = source.resetGeneration;
    const reason = source.resetReason;
    this.logger.debug(
      `[scrcpy:${active.udid}:${sessionId}] requested encoder reset generation=${generation} reason=${reason}`,
    );
    source.stream.sendStatus({
      type: "video-reset",
      generation,
      reason,
      count: source.resetCount,
    });
    source.resetWatchdog = setTimeout(() => {
      source.resetWatchdog = null;
      if (
        this.sources.get(sessionId) !== source ||
        source.resetGeneration !== generation ||
        (source.resetSawConfig && source.resetSawKeyFrame)
      ) {
        return;
      }
      this.logger.warn(
        `[scrcpy:${active.udid}:${sessionId}] encoder reset generation=${generation} did not produce configuration and IDR within ${VIDEO_RESET_WATCHDOG_MS}ms; restarting scrcpy attempt`,
      );
      this.runInBackground(
        source.restartAttempt?.(),
        `[scrcpy:${active.udid}:${sessionId}] encoder reset watchdog restart`,
      );
    }, VIDEO_RESET_WATCHDOG_MS);
    source.resetWatchdog.unref?.();
  }

  private observeVideoReset(
    source: ActiveScrcpySource,
    packet: ScrcpyPacket,
  ): void {
    if (!source.resetWatchdog) {
      return;
    }
    if (packet.config) {
      source.resetSawConfig = true;
    }
    if (!packet.config && packet.keyFrame) {
      source.resetSawKeyFrame = true;
    }
    if (!source.resetSawConfig || !source.resetSawKeyFrame) {
      return;
    }
    clearTimeout(source.resetWatchdog);
    source.resetWatchdog = null;
    source.stream.sendStatus({
      type: "video-reset-complete",
      generation: source.resetGeneration,
      count: source.resetCount,
    });
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
