import { configuredStreamProfile } from "./config.js";
import type {
  MediaWorkerMessage,
  ReconnectCause,
} from "./display-media-worker.js";
import { MseVideoPlayer } from "./mse-video-player.js";
import {
  emitViewerSessionExpired,
  emitViewerSessionReady,
  emitViewerStreamMetrics,
  emitViewerStreamStatus,
  statusFromCompatibility,
} from "./stream-status.js";
import type {
  DisplayTransport,
  PageLifecycle,
  ViewerConfig,
  ViewerUi,
} from "./types.js";
import type { ViewerPresentation } from "./viewer-presentation.js";

type DisplayStreamOptions = {
  config: ViewerConfig;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
  presentation?: ViewerPresentation;
};

async function createAudioWorklet(): Promise<{
  context: AudioContext;
  output: GainNode;
  workerPort: MessagePort;
}> {
  if (!("AudioWorkletNode" in window)) {
    throw new Error("This browser does not support low-latency display audio.");
  }
  const context = new AudioContext({
    latencyHint: "interactive",
    sampleRate: 48_000,
  });
  try {
    await context.audioWorklet.addModule(
      new URL("./display-audio-worklet.js", import.meta.url),
    );
    const node = new AudioWorkletNode(context, "rebroid-audio", {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    const output = context.createGain();
    node.connect(output).connect(context.destination);
    const channel = new MessageChannel();
    node.port.postMessage({ type: "connect", port: channel.port1 }, [
      channel.port1,
    ]);
    return { context, output, workerPort: channel.port2 };
  } catch (error) {
    void context.close().catch(() => undefined);
    throw error;
  }
}

function websocketUrl(config: ViewerConfig): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const streamParams = new URLSearchParams({
    sessionId: config.sessionId ?? "",
    audio: config.audio ? "1" : "0",
  });
  for (const [key, value] of Object.entries(config.streamDefaults)) {
    streamParams.set(key, config.params.get(key) ?? value);
  }
  return `${protocol}//${location.host}/rebroid/display/stream?${streamParams.toString()}`;
}

export function createDisplayStream({
  config,
  ui,
  lifecycle,
  presentation,
}: DisplayStreamOptions): DisplayTransport {
  let worker: Worker | null = null;
  let workerReady = false;
  let audioContext: AudioContext | null = null;
  let audioOutput: GainNode | null = null;
  let audioWasRunning = false;
  let msePlayer: MseVideoPlayer | null = null;
  let mseVideo: HTMLVideoElement | null = null;
  let initialized = false;
  let requested = false;
  let active = lifecycle.hasDemand();
  let demandEpoch = 0;
  let terminal = false;
  let connectAt: number | undefined;
  let hasVisibleFrame = false;

  const showAudioDisabled = (message?: unknown) => {
    emitViewerStreamStatus({
      code: "audio-disabled",
      severity: "info",
      blocking: false,
      message:
        typeof message === "string"
          ? message
          : "Audio capture is disabled for this stream.",
      transport: "websocket",
    });
  };

  const handleStatus = (payload: Record<string, unknown>) => {
    if (payload.type === "compatibility") {
      const status = statusFromCompatibility({
        mode: payload.mode,
        message: payload.message,
        diagnostic: payload.diagnostic,
        transport: "websocket",
        hasVisibleFrame,
      });
      if (status) {
        emitViewerStreamStatus(status);
      }
      ui.showCompatibility(
        typeof payload.mode === "string" ? payload.mode : "normal",
        typeof payload.message === "string" ? payload.message : undefined,
      );
      return;
    }
    if (payload.type === "clipboard" && typeof payload.text === "string") {
      if (presentation?.isCompact()) return;
      window.parent.postMessage(
        { type: "rebroid-viewer-clipboard", text: payload.text },
        window.location.origin,
      );
      if (navigator.clipboard && document.visibilityState === "visible") {
        void navigator.clipboard.writeText(payload.text).catch(() => undefined);
      }
      return;
    }
    if (payload.type === "audio-disabled") {
      showAudioDisabled(payload.message);
      return;
    }
    if (payload.type === "reconnecting") {
      emitViewerStreamStatus({
        code: "reconnecting",
        severity: hasVisibleFrame ? "info" : "warning",
        blocking: !hasVisibleFrame,
        message:
          typeof payload.message === "string"
            ? payload.message
            : "Reconnecting live display...",
        transport: "websocket",
      });
    }
  };

  const handleWorkerMessage = (event: MessageEvent<MediaWorkerMessage>) => {
    const message = event.data;
    if (!active || terminal || message.demandEpoch !== demandEpoch) return;
    if (message.type === "stream-requested") {
      connectAt = message.at;
      return;
    }
    if (message.type === "first-frame") {
      emitViewerSessionReady("websocket", config.sessionId, connectAt);
      closeMsePlayer();
      hasVisibleFrame = true;
      ui.showCanvas();
      return;
    }
    if (message.type === "resolution") {
      return;
    }
    if (message.type === "status") {
      handleStatus(message.payload);
      return;
    }
    if (message.type === "metrics") {
      if (!msePlayer) {
        emitViewerStreamMetrics(message.metrics);
        return;
      }
      const nativeMetrics = msePlayer.snapshot(
        (message.metrics.sourceFps ?? 0) > 0,
      );
      const epoch = msePlayer.activeEpoch();
      if (epoch !== null) {
        worker?.postMessage({
          type: "watermark",
          epoch,
          decodedSequence: nativeMetrics.highestDecodedSequence,
          presentedSequence: nativeMetrics.highestPresentedSequence,
          presentedTimestampUs: nativeMetrics.highestPresentedTimestampUs,
        });
      }
      emitViewerStreamMetrics({
        ...message.metrics,
        ...nativeMetrics,
        renderer: "firefox-mse",
        decoderPreference: "native",
        presentationSequenceLag:
          message.metrics.highestReceivedSequence !== undefined &&
          nativeMetrics.highestPresentedSequence !== undefined
            ? (message.metrics.highestReceivedSequence -
                nativeMetrics.highestPresentedSequence) >>>
              0
            : undefined,
      });
      return;
    }
    if (message.type === "mse-reset") {
      msePlayer?.discardBefore(message.epoch);
      return;
    }
    if (message.type === "mse-init") {
      const video = mseVideo;
      if (!video) return;
      try {
        if (hasVisibleFrame) {
          ui.preserveVideoFrame(video);
        }
        msePlayer ??= createMsePlayer(video);
        msePlayer.initialize(
          message.codec,
          message.segment,
          message.sourcePtsOriginUs,
          message.epoch,
          { width: message.width, height: message.height },
        );
      } catch (error) {
        closeMsePlayer();
        worker?.postMessage({
          type: "use-webcodecs-fallback",
          epoch: message.epoch,
        });
        console.warn(
          "Firefox native WebSocket playback is unavailable; using WebCodecs.",
          error,
        );
      }
      return;
    }
    if (message.type === "renderer-fallback") {
      if (msePlayer && mseVideo && hasVisibleFrame) {
        ui.preserveVideoFrame(mseVideo);
      }
      closeMsePlayer();
      hasVisibleFrame = false;
      console.warn(
        "Firefox native WebSocket playback failed; using WebCodecs.",
        message.reason,
      );
      return;
    }
    if (message.type === "mse-segment") {
      msePlayer?.appendMedia(message);
      return;
    }
    if (message.type === "reconnecting") {
      console.warn("Display stream consumer reconnecting.", message.cause);
      emitViewerStreamStatus({
        code: "reconnecting",
        severity: hasVisibleFrame ? "info" : "warning",
        blocking: !hasVisibleFrame,
        message: message.cause.detail,
        sessionId: config.sessionId,
        failureStage: message.cause.category,
        closeCode: message.cause.closeCode,
        transport: "websocket",
      });
      if (!hasVisibleFrame) {
        ui.showStatus(
          "Reconnecting...",
          "Starting live display",
          "Rebroid is opening the app screen.",
        );
      }
      return;
    }
    if (message.type === "session-expired") {
      stopPermanently();
      emitViewerSessionExpired("websocket", config.sessionId);
      ui.showFailure(
        "The display session ended. Open the viewer again to continue.",
      );
      return;
    }
    showFailure(
      message.message,
      message.closeCode === 4409 ? "profile-conflict" : "playback",
      message.closeCode,
    );
  };

  function createMsePlayer(video: HTMLVideoElement): MseVideoPlayer {
    const player = new MseVideoPlayer(
      video,
      (epoch, frame) => {
        if (!active || msePlayer !== player || player.activeEpoch() !== epoch) {
          return;
        }
        emitViewerSessionReady("websocket", config.sessionId, connectAt);
        hasVisibleFrame = true;
        ui.showVideo();
        worker?.postMessage({ type: "mse-presented", epoch, ...frame });
      },
      (reason, epoch) => {
        if (active && msePlayer === player) {
          worker?.postMessage({ type: "mse-resync", reason, epoch });
        }
      },
    );
    return player;
  }

  function closeMsePlayer(): void {
    const previous = msePlayer;
    msePlayer = null;
    previous?.close();
  }

  function stopPermanently(): void {
    terminal = true;
    workerReady = false;
    worker?.postMessage({ type: "close" });
    worker = null;
    void audioContext?.close().catch(() => undefined);
    audioContext = null;
    audioOutput = null;
    closeMsePlayer();
    mseVideo = null;
  }

  const onVisibilityChange = () => {
    worker?.postMessage({
      type: "visibility",
      visible: document.visibilityState === "visible",
    });
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const resumeAudio = () => {
    if (active && audioContext?.state === "suspended") {
      void audioContext.resume().catch(() => undefined);
    }
  };
  const stopWatchingPresentation = presentation?.onChange((compact) => {
    if (audioOutput) audioOutput.gain.value = compact ? 0 : 1;
    if (!compact) resumeAudio();
  });

  const stopWatchingDemand = lifecycle.onDemandChange((next) => {
    if (active === next || terminal) return;
    active = next;
    demandEpoch += 1;
    if (workerReady) {
      worker?.postMessage({ type: "demand", active, epoch: demandEpoch });
    }
    if (!active) {
      if (msePlayer && mseVideo && hasVisibleFrame) {
        ui.preserveVideoFrame(mseVideo);
      }
      closeMsePlayer();
      audioWasRunning ||= audioContext?.state === "running";
      void audioContext?.suspend().catch(() => undefined);
    } else {
      if (audioWasRunning) {
        void audioContext?.resume().catch(() => undefined);
      }
      if (requested) void start().catch(handleStartupError);
    }
  });

  lifecycle.onClose(() => {
    stopWatchingDemand();
    stopWatchingPresentation?.();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pointerdown", resumeAudio);
    stopPermanently();
  });

  function handleStartupError(error: unknown): void {
    if (terminal) return;
    showFailure(error instanceof Error ? error.message : "The display media worker failed.", "startup");
  }

  function showFailure(message: string, failureStage: string, closeCode?: number) {
    stopPermanently();
    emitViewerStreamStatus({
      code: "stream-error", severity: "error", blocking: true, message,
      sessionId: config.sessionId, failureStage, closeCode, transport: "websocket",
    });
    ui.showFailure(message);
  }

  async function start(): Promise<void> {
    if (initialized || !active || terminal || lifecycle.isClosing()) {
      return;
    }
    if (!config.sessionId) {
      ui.showFailure("Open the viewer again from the app page.");
      return;
    }
    const firefoxMse =
      navigator.userAgent.includes("Firefox/") && "MediaSource" in window;
    const webCodecs = "VideoDecoder" in window && "EncodedVideoChunk" in window;
    if (
      !("Worker" in window) ||
      (!firefoxMse && !webCodecs) ||
      !("transferControlToOffscreen" in HTMLCanvasElement.prototype)
    ) {
      ui.showFailure(
        "WebSocket playback requires Worker, OffscreenCanvas, and either MediaSource or WebCodecs.",
      );
      return;
    }

    initialized = true;
    ui.showStatus(
      "Waiting for the first frame...",
      "Starting live display",
      "Rebroid is opening the app screen.",
    );
    worker = new Worker(new URL("./display-media-worker.js", import.meta.url), {
      type: "module",
      name: "rebroid-display-media",
    });
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", (event) => {
      handleStartupError(
        new Error(event.message || "The display media worker failed."),
      );
    });
    const canvas = document.getElementById("screen");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Viewer canvas is missing.");
    }
    const video = document.getElementById("screen-video");
    if (firefoxMse && video instanceof HTMLVideoElement) {
      mseVideo = video;
    }
    const offscreen = canvas.transferControlToOffscreen();
    const transfer: Transferable[] = [offscreen];
    let audioPort: MessagePort | undefined;
    if (config.audio) {
      try {
        const audio = await createAudioWorklet();
        if (terminal || lifecycle.isClosing()) {
          audio.workerPort.close();
          void audio.context.close().catch(() => undefined);
          return;
        }
        audioContext = audio.context;
        audioOutput = audio.output;
        audioOutput.gain.value = presentation?.isCompact() ? 0 : 1;
        if (!active) {
          audioWasRunning = audioContext.state === "running";
          void audioContext.suspend().catch(() => undefined);
        }
        audioPort = audio.workerPort;
        transfer.push(audioPort);
      } catch (error) {
        if (active && !terminal) {
          showAudioDisabled(error instanceof Error ? error.message : undefined);
        }
      }
    }
    if (!worker || terminal || lifecycle.isClosing()) return;
    worker.postMessage(
      {
        type: "init",
        url: websocketUrl(config),
        canvas: offscreen,
        audio: Boolean(audioPort),
        audioPort,
        effectiveProfile: configuredStreamProfile(config, "websocket"),
        renderer: firefoxMse ? "mse" : "webcodecs",
        visible: document.visibilityState === "visible",
        demand: active,
        demandEpoch,
      },
      transfer,
    );
    workerReady = true;
    window.addEventListener("pointerdown", resumeAudio, { passive: true });
  }

  return {
    async connect() {
      requested = true;
      await start().catch(handleStartupError);
    },
    scheduleReconnect() {
      if (!active || terminal) return;
      worker?.postMessage({
        type: "reconnect",
        cause: {
          initiator: "main",
          category: "socket",
          generation: 0,
          detail: "Display consumer requested reconnection.",
        } satisfies ReconnectCause,
      });
    },
  };
}
