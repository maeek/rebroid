import { configuredStreamProfile } from "./config.js";
import { MseVideoPlayer, type MseMediaSegment } from "./mse-video-player.js";
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
  ViewerStreamMetricsV4,
  ViewerUi,
} from "./types.js";

type DisplayStreamOptions = {
  config: ViewerConfig;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
};

type ReconnectCause = {
  initiator: "worker" | "main" | "transport";
  category:
    | "heartbeat"
    | "first-frame"
    | "malformed-media"
    | "socket"
    | "video-progress";
  generation: number;
  closeCode?: number;
  detail: string;
};

type MediaWorkerMessage =
  | { type: "first-frame" }
  | { type: "stream-requested"; at: number }
  | { type: "resolution"; width: number; height: number }
  | { type: "status"; payload: Record<string, unknown> }
  | { type: "metrics"; metrics: ViewerStreamMetricsV4 }
  | { type: "mse-reset"; epoch: number }
  | {
      type: "mse-init";
      epoch: number;
      codec: string;
      width: number;
      height: number;
      sourcePtsOriginUs: number;
      segment: ArrayBuffer;
    }
  | ({ type: "mse-segment" } & MseMediaSegment)
  | { type: "renderer-fallback"; reason: string }
  | { type: "reconnecting"; cause: ReconnectCause; delayMs: number }
  | { type: "session-expired" }
  | { type: "fatal"; message: string };

async function createAudioWorklet(): Promise<{
  context: AudioContext;
  workerPort: MessagePort;
}> {
  if (!("AudioWorkletNode" in window)) {
    throw new Error("This browser does not support low-latency display audio.");
  }
  const context = new AudioContext({
    latencyHint: "interactive",
    sampleRate: 48_000,
  });
  await context.audioWorklet.addModule(
    new URL("./display-audio-worklet.js", import.meta.url),
  );
  const node = new AudioWorkletNode(context, "rebroid-audio", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  node.connect(context.destination);
  const channel = new MessageChannel();
  node.port.postMessage({ type: "connect", port: channel.port1 }, [
    channel.port1,
  ]);
  return { context, workerPort: channel.port2 };
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
}: DisplayStreamOptions): DisplayTransport {
  let worker: Worker | null = null;
  let audioContext: AudioContext | null = null;
  let msePlayer: MseVideoPlayer | null = null;
  let mseVideo: HTMLVideoElement | null = null;
  let initialized = false;
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
    if (message.type === "stream-requested") {
      connectAt = message.at;
      return;
    }
    if (message.type === "first-frame") {
      emitViewerSessionReady("websocket", config.sessionId, connectAt);
      if (!hasVisibleFrame) {
        hasVisibleFrame = true;
        ui.showCanvas();
      }
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
      try {
        if (hasVisibleFrame && mseVideo) {
          ui.preserveVideoFrame(mseVideo);
        }
        msePlayer?.initialize(
          message.codec,
          message.segment,
          message.sourcePtsOriginUs,
          message.epoch,
        );
      } catch (error) {
        msePlayer?.close();
        msePlayer = null;
        worker?.postMessage({ type: "use-webcodecs-fallback" });
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
      msePlayer?.close();
      msePlayer = null;
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
      emitViewerSessionExpired("websocket", config.sessionId);
      ui.showFailure(
        "The display session ended. Open the viewer again to continue.",
      );
      return;
    }
    ui.showFailure(message.message);
  };

  const onVisibilityChange = () => {
    worker?.postMessage({
      type: "visibility",
      visible: document.visibilityState === "visible",
    });
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  lifecycle.onClose(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    worker?.postMessage({ type: "close" });
    worker = null;
    void audioContext?.close().catch(() => undefined);
    audioContext = null;
    msePlayer?.close();
    msePlayer = null;
    mseVideo = null;
  });

  async function connect(): Promise<void> {
    if (initialized) {
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
      ui.showFailure(event.message || "The display media worker failed.");
    });
    const canvas = document.getElementById("screen");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Viewer canvas is missing.");
    }
    const video = document.getElementById("screen-video");
    if (firefoxMse && video instanceof HTMLVideoElement) {
      mseVideo = video;
      ui.preserveVideoFrame(video);
      msePlayer = new MseVideoPlayer(
        video,
        (epoch) => {
          emitViewerSessionReady("websocket", config.sessionId, connectAt);
          hasVisibleFrame = true;
          ui.showVideo();
          worker?.postMessage({ type: "mse-presented", epoch });
        },
        (reason, epoch) => {
          worker?.postMessage({ type: "mse-resync", reason, epoch });
        },
      );
    }
    const offscreen = canvas.transferControlToOffscreen();
    const transfer: Transferable[] = [offscreen];
    let audioPort: MessagePort | undefined;
    if (config.audio) {
      try {
        const audio = await createAudioWorklet();
        audioContext = audio.context;
        audioPort = audio.workerPort;
        transfer.push(audioPort);
      } catch (error) {
        showAudioDisabled(error instanceof Error ? error.message : undefined);
      }
    }
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
      },
      transfer,
    );
    window.addEventListener(
      "pointerdown",
      () => {
        if (audioContext?.state === "suspended") {
          void audioContext.resume().catch(() => undefined);
        }
      },
      { passive: true },
    );
  }

  return {
    connect,
    scheduleReconnect() {
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
