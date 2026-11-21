import {
  PermanentWebrtcError,
  preferH264PacketizationModeOne,
  requestWebrtcAnswer,
  waitForConnected,
  waitForIceGathering,
  WebrtcSessionExpiredError,
} from "./webrtc-negotiation.js";
import type {
  ControlChannel,
  PageLifecycle,
  ViewerConfig,
  ViewerUi,
  ViewerRelayMetrics,
} from "./types.js";
import { configuredStreamProfile } from "./config.js";
import { DisplaySizePresentationTracker } from "./display-size-presentation.js";
import {
  AdaptiveJitterBufferController,
  startWebrtcMetricsMonitor,
  videoFrameCallbackApi,
} from "./webrtc-metrics-monitor.js";
import type { ViewerPresentation } from "./viewer-presentation.js";
import {
  emitViewerSessionExpired,
  emitViewerSessionReady,
  emitViewerStreamStatus,
} from "./stream-status.js";

type WebrtcStreamOptions = {
  config: ViewerConfig;
  video: HTMLVideoElement;
  controlChannel: ControlChannel;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
  presentation?: ViewerPresentation;
  getRelayMetrics: () => ViewerRelayMetrics | null;
};

const webrtcRetryDelaysMs = [300, 750, 1_500] as const;
const iceDisconnectedGraceMs = 5_000;
function waitForFirstVideoFrame(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video frame arrived."));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", onFrame);
      video.removeEventListener("playing", onFrame);
      video.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    };
    const onFrame = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        cleanup();
        resolve();
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error("WebRTC video playback failed."));
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    video.addEventListener("loadeddata", onFrame);
    video.addEventListener("playing", onFrame);
    video.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function clearVideo(video: HTMLVideoElement): void {
  const stream = video.srcObject;
  video.pause();
  video.removeAttribute("src");
  video.srcObject = null;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

function closePeer(
  peer: RTCPeerConnection | null,
  video: HTMLVideoElement,
): void {
  clearVideo(video);
  peer?.close();
}

function waitForTrack(
  connection: RTCPeerConnection,
  video: HTMLVideoElement,
  isAudioAudible: () => boolean,
  jitterController: AdaptiveJitterBufferController,
  signal: AbortSignal,
): Promise<void> {
  const mediaStream = new MediaStream();
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video track arrived."));
    }, 6000);
    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeEventListener("track", onTrack);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new Error("WebRTC attempt ended before its video track arrived."));
    };
    const onTrack = (event: RTCTrackEvent) => {
      jitterController.add(event.receiver);
      if (event.track.kind !== "video") {
        if (!event.streams.length) mediaStream.addTrack(event.track);
        return;
      }
      const [stream] = event.streams;
      const previous = video.srcObject;
      if (stream) {
        video.srcObject = stream;
      } else {
        mediaStream.addTrack(event.track);
        video.srcObject = mediaStream;
      }
      if (previous instanceof MediaStream && previous !== video.srcObject) {
        for (const track of previous.getTracks()) track.stop();
      }
      void playVideoWithAutoplayFallback(video, isAudioAudible(), signal);
      cleanup();
      resolve();
    };
    connection.addEventListener("track", onTrack);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function playVideoWithAutoplayFallback(
  video: HTMLVideoElement,
  audioRequested: boolean,
  signal: AbortSignal,
): Promise<void> {
  video.muted = !audioRequested;
  try {
    await video.play();
  } catch {
    if (signal.aborted) return;
    video.muted = true;
    await video.play().catch(() => undefined);
  }
}

export function createWebrtcStream({
  config,
  video,
  controlChannel,
  ui,
  lifecycle,
  presentation,
  getRelayMetrics,
}: WebrtcStreamOptions) {
  const viewerId = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const displaySizePresentation = new DisplaySizePresentationTracker();
  let stopSizeObservation: (() => void) | null = null;
  let peer: RTCPeerConnection | null = null;
  let terminalFailure = false;
  let stopMetricsMonitor: (() => void) | null = null;
  let stopConnectionMonitor: (() => void) | null = null;
  let retryTimer = 0;
  let retriesUsed = 0;
  let reconnectCount = 0;
  let peerGeneration = 0;
  let attemptAbort: AbortController | null = null;
  let consumerAttemptId: string | undefined;
  let heldPicture = false;
  let started = false;
  let hadDemand = lifecycle.hasDemand();
  const isAudioAudible = () => config.audio && !presentation?.isCompact();
  const stopWatchingPresentation = presentation?.onChange(() => {
    const audible = isAudioAudible();
    const signal = attemptAbort?.signal;
    if (audible && signal && video.srcObject) {
      void playVideoWithAutoplayFallback(video, audible, signal);
    } else {
      video.muted = !audible;
    }
  });

  const clearRetry = () => {
    if (!retryTimer) return;
    window.clearTimeout(retryTimer);
    retryTimer = 0;
  };

  const retireAttempt = () => {
    attemptAbort?.abort();
    attemptAbort = null;
    stopSizeObservation?.();
    stopSizeObservation = null;
    stopMetricsMonitor?.();
    stopMetricsMonitor = null;
    stopConnectionMonitor?.();
    stopConnectionMonitor = null;
    const retiringPeer = peer;
    peer = null;
    return retiringPeer;
  };

  const observeDisplaySize = (
    connection: RTCPeerConnection,
    generation: number,
    trackReady: Promise<void>,
  ) => {
    const { request, cancel } = videoFrameCallbackApi(video);
    if (!request) return;
    let handle: number | undefined;
    let active = true;
    const isCurrent = () =>
      active &&
      peer === connection &&
      peerGeneration === generation &&
      lifecycle.hasDemand() &&
      !lifecycle.isClosing();
    stopSizeObservation = () => {
      active = false;
      if (handle !== undefined) cancel?.(handle);
    };
    const observe = () => {
      if (!isCurrent()) return;
      handle = request((at, metadata) => {
        if (!isCurrent()) return;
        const accepted = displaySizePresentation.present(
          {
            width: metadata.width ?? video.videoWidth,
            height: metadata.height ?? video.videoHeight,
          },
          at,
        );
        if (!accepted) observe();
      });
    };
    void trackReady.then(observe, () => undefined);
  };

  video.addEventListener(
    "pointerdown",
    () => {
      if (!lifecycle.hasDemand()) return;
      if (isAudioAudible()) {
        video.muted = false;
      }
      void video.play().catch(() => undefined);
    },
    { passive: true },
  );

  const failPermanently = (
    reason: string,
    sessionExpired = false,
    failureStage?: string,
  ) => {
    if (terminalFailure || lifecycle.isClosing() || !lifecycle.hasDemand()) {
      return;
    }
    terminalFailure = true;
    clearRetry();
    if (sessionExpired) {
      emitViewerSessionExpired("webrtc", config.sessionId);
    } else {
      emitViewerStreamStatus({
        code: "stream-error",
        severity: "error",
        blocking: true,
        message: reason,
        sessionId: config.sessionId,
        consumerAttemptId,
        failureStage,
        transport: "webrtc",
      });
    }
    closePeer(retireAttempt(), video);
    ui.showFailure(reason);
  };

  const unsubscribeDemand = lifecycle.onDemandChange((active) => {
    if (active === hadDemand) return;
    hadDemand = active;
    if (!started || terminalFailure || lifecycle.isClosing()) return;
    if (active) {
      displaySizePresentation.beginRecovery(performance.now());
      void connectAttempt().catch(() => retryOrFail("WebRTC resume failed."));
      return;
    }
    clearRetry();
    retriesUsed = 0;
    displaySizePresentation.cancelPending();
    if (peer && !heldPicture) heldPicture = ui.preserveVideoFrame(video);
    closePeer(retireAttempt(), video);
  });

  lifecycle.onClose(() => {
    unsubscribeDemand();
    stopWatchingPresentation?.();
    clearRetry();
    closePeer(retireAttempt(), video);
  });

  const retryOrFail = (reason: string, failureStage = "peer-recovery") => {
    if (
      !started ||
      terminalFailure ||
      lifecycle.isClosing() ||
      !lifecycle.hasDemand() ||
      retryTimer
    ) {
      return;
    }
    displaySizePresentation.beginRecovery(performance.now());
    reconnectCount += 1;
    if (!heldPicture) heldPicture = ui.preserveVideoFrame(video);
    retireAttempt()?.close();
    if (retriesUsed >= webrtcRetryDelaysMs.length) {
      console.warn("WebRTC recovery exhausted.", reason);
      failPermanently(
        `WebRTC stopped after ${webrtcRetryDelaysMs.length} recovery attempts: ${reason}`,
        false,
        failureStage,
      );
      return;
    }
    const delayMs = webrtcRetryDelaysMs[retriesUsed]!;
    retriesUsed += 1;
    emitViewerStreamStatus({
      code: "reconnecting",
      severity: "info",
      blocking: !heldPicture,
      message: reason,
      sessionId: config.sessionId,
      consumerAttemptId,
      failureStage,
      transport: "webrtc",
    });
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      void connectAttempt();
    }, delayMs);
  };

  const monitorConnection = (
    connection: RTCPeerConnection,
    currentGeneration: number,
  ) => {
    let disconnectedTimer = 0;
    const clearDisconnectedTimer = () => {
      if (disconnectedTimer) {
        window.clearTimeout(disconnectedTimer);
        disconnectedTimer = 0;
      }
    };
    const check = () => {
      if (peer !== connection || peerGeneration !== currentGeneration) {
        clearDisconnectedTimer();
        return;
      }
      if (
        connection.connectionState === "failed" ||
        connection.connectionState === "closed" ||
        connection.iceConnectionState === "failed" ||
        connection.iceConnectionState === "closed"
      ) {
        clearDisconnectedTimer();
        retryOrFail(
          `WebRTC connection ${connection.connectionState}/${connection.iceConnectionState}.`,
        );
        return;
      }
      if (connection.iceConnectionState === "disconnected") {
        if (!disconnectedTimer) {
          disconnectedTimer = window.setTimeout(() => {
            disconnectedTimer = 0;
            if (
              peer === connection &&
              connection.iceConnectionState === "disconnected"
            ) {
              retryOrFail("WebRTC ICE remained disconnected for 5 seconds.");
            }
          }, iceDisconnectedGraceMs);
        }
        return;
      }
      clearDisconnectedTimer();
    };
    connection.addEventListener("connectionstatechange", check);
    connection.addEventListener("iceconnectionstatechange", check);
    return () => {
      clearDisconnectedTimer();
      connection.removeEventListener("connectionstatechange", check);
      connection.removeEventListener("iceconnectionstatechange", check);
    };
  };

  async function connectAttempt(): Promise<void> {
    if (
      lifecycle.isClosing() ||
      !lifecycle.hasDemand() ||
      terminalFailure ||
      peer
    )
      return;
    if (!config.sessionId) {
      failPermanently("Open the viewer again from the app page.");
      return;
    }
    if (!("RTCPeerConnection" in window)) {
      failPermanently("This browser does not support WebRTC playback.");
      return;
    }

    if (!heldPicture) {
      const title = retriesUsed
        ? "Reconnecting live display"
        : "Connecting to live display";
      ui.showStatus(`${title}…`, title, "The app screen will appear here.");
    }
    const currentGeneration = ++peerGeneration;
    consumerAttemptId = undefined;
    let failureStage = "signaling";
    const connection = new RTCPeerConnection();
    const jitterController = new AdaptiveJitterBufferController();
    const controller = new AbortController();
    const { signal } = controller;
    attemptAbort = controller;
    peer = connection;
    const isCurrent = () =>
      !signal.aborted &&
      lifecycle.hasDemand() &&
      !lifecycle.isClosing() &&
      peer === connection &&
      peerGeneration === currentGeneration;
    const recoverCurrent = (reason: string, stage = failureStage) => {
      if (isCurrent()) retryOrFail(reason, stage);
    };
    stopConnectionMonitor = monitorConnection(connection, currentGeneration);
    const reliableChannel = connection.createDataChannel("rebroid-control", {
      ordered: true,
    });
    const movementChannel = connection.createDataChannel("rebroid-pointer", {
      ordered: false,
      maxRetransmits: 0,
    });
    reliableChannel.addEventListener(
      "close",
      () => {
        recoverCurrent("WebRTC control channel closed.", "control-channel");
      },
      { once: true, signal },
    );
    let videoResetDeadline = 0;
    const videoTransceiver = connection.addTransceiver("video", {
      direction: "recvonly",
    });
    preferH264PacketizationModeOne(videoTransceiver);
    if (config.audio) {
      connection.addTransceiver("audio", { direction: "recvonly" });
    }
    video.muted = !isAudioAudible();

    try {
      const offer = await connection.createOffer();
      signal.throwIfAborted();
      await connection.setLocalDescription(offer);
      await waitForIceGathering(connection, signal);
      signal.throwIfAborted();
      const trackReady = waitForTrack(
        connection,
        video,
        isAudioAudible,
        jitterController,
        signal,
      );
      // Signaling can fail before the track wait is consumed.
      void trackReady.catch(() => undefined);
      observeDisplaySize(connection, currentGeneration, trackReady);

      const offerAt = performance.timeOrigin + performance.now();
      const answer = await requestWebrtcAnswer(
        config.sessionId,
        config,
        viewerId,
        connection.localDescription?.sdp ?? offer.sdp,
        signal,
      );
      if (answer.transport === "websocket") {
        if (isCurrent()) {
          const url = new URL(location.href);
          url.searchParams.set("transport", "websocket");
          location.replace(url.href);
        } else {
          connection.close();
        }
        return;
      }
      signal.throwIfAborted();
      consumerAttemptId = answer.attemptId;
      controlChannel.useDataChannels(
        reliableChannel,
        movementChannel,
        () => recoverCurrent("WebRTC video codec configuration changed."),
        (remainingMs) => {
          videoResetDeadline = performance.now() + Math.min(remainingMs, 3_000);
        },
        answer.canControl,
      );
      failureStage = "connection";
      await connection.setRemoteDescription({
        type: "answer",
        sdp: answer.sdp,
      });
      await waitForConnected(connection, signal);
      failureStage = "first-frame";
      if (!heldPicture && !retriesUsed && isCurrent()) {
        ui.showStatus(
          "Waiting for the first frame…",
          "Waiting for the first frame",
          "The app screen will appear here.",
        );
      }
      await trackReady;
      await waitForFirstVideoFrame(video, signal);
      if (!isCurrent()) {
        connection.close();
        return;
      }
      heldPicture = false;
      failureStage = "playback";
      ui.showVideo();
      emitViewerSessionReady("webrtc", config.sessionId, offerAt);
      retriesUsed = 0;
      stopSizeObservation?.();
      stopSizeObservation = null;
      stopMetricsMonitor?.();
      stopMetricsMonitor = startWebrtcMetricsMonitor({
        peer: connection,
        video,
        effectiveProfile: configuredStreamProfile(config, "webrtc"),
        getRelayMetrics,
        consumerGeneration: currentGeneration,
        getReconnectCount: () => reconnectCount,
        jitterController,
        negotiatedProfileLevelId: answer.profileLevelId,
        onStall: () =>
          recoverCurrent("WebRTC video stopped presenting frames."),
        waitingForVideoReset: () => performance.now() < videoResetDeadline,
        reliableChannel,
        displaySizePresentation,
      });
    } catch (error) {
      if (isCurrent()) {
        const reason =
          error instanceof Error ? error.message : "WebRTC recovery failed.";
        if (error instanceof PermanentWebrtcError) {
          failPermanently(
            reason,
            error instanceof WebrtcSessionExpiredError,
            failureStage,
          );
        } else {
          retryOrFail(reason, failureStage);
        }
      } else if (connection.connectionState !== "closed") {
        connection.close();
      }
    }
  }

  async function connect(): Promise<void> {
    if (started) return;
    started = true;
    await connectAttempt();
  }

  return {
    connect,
    scheduleReconnect() {
      retryOrFail("WebRTC reconnection requested.");
    },
  };
}
