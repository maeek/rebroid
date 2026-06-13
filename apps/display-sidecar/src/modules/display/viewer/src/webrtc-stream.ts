import type {
  ControlChannel,
  PageLifecycle,
  ViewerConfig,
  ViewerUi,
} from "./types";

type WebrtcStreamOptions = {
  config: ViewerConfig;
  video: HTMLVideoElement;
  controlChannel: ControlChannel;
  ui: ViewerUi;
  lifecycle: PageLifecycle;
  fallback: () => void;
};

type WebrtcAnswer = {
  transport?: string;
  codec?: string;
  sdp?: string;
  iceServers?: string[];
};

type VideoFrameCallbackMetadata = {
  presentedFrames?: number;
  mediaTime?: number;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameCallbackMetadata) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const webrtcFrameProgressTimeoutMs = 12_000;

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    peer.addEventListener(
      "icegatheringstatechange",
      () => {
        if (peer.iceGatheringState === "complete") {
          resolve();
        }
      },
      { once: false },
    );
    window.setTimeout(resolve, 1500);
  });
}

function waitForConnected(peer: RTCPeerConnection): Promise<void> {
  if (
    peer.connectionState === "connected" ||
    peer.iceConnectionState === "connected" ||
    peer.iceConnectionState === "completed"
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("WebRTC did not connect in time.")),
      6000,
    );
    const cleanup = () => {
      clearTimeout(timeout);
      peer.removeEventListener("connectionstatechange", checkState);
      peer.removeEventListener("iceconnectionstatechange", checkState);
    };
    const checkState = () => {
      if (
        peer.connectionState === "connected" ||
        peer.iceConnectionState === "connected" ||
        peer.iceConnectionState === "completed"
      ) {
        cleanup();
        resolve();
      }
      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed" ||
        peer.iceConnectionState === "failed" ||
        peer.iceConnectionState === "closed"
      ) {
        const state =
          peer.connectionState === "failed" || peer.connectionState === "closed"
            ? peer.connectionState
            : peer.iceConnectionState;
        cleanup();
        reject(new Error(`WebRTC connection ${state}.`));
      }
    };
    peer.addEventListener("connectionstatechange", checkState);
    peer.addEventListener("iceconnectionstatechange", checkState);
  });
}

function waitForFirstVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video frame arrived."));
    }, 10_000);
    const cleanup = () => {
      clearTimeout(timeout);
      video.removeEventListener("loadeddata", onFrame);
      video.removeEventListener("playing", onFrame);
      video.removeEventListener("error", onError);
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
    video.addEventListener("loadeddata", onFrame);
    video.addEventListener("playing", onFrame);
    video.addEventListener("error", onError);
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

function videoTracks(video: HTMLVideoElement): MediaStreamTrack[] {
  return video.srcObject instanceof MediaStream
    ? video.srcObject.getVideoTracks()
    : [];
}

function videoFrameCallbackApi(video: HTMLVideoElement) {
  const candidate = video as unknown as VideoWithFrameCallback;
  const request =
    typeof candidate.requestVideoFrameCallback === "function"
      ? candidate.requestVideoFrameCallback.bind(candidate)
      : null;
  const cancel =
    typeof candidate.cancelVideoFrameCallback === "function"
      ? candidate.cancelVideoFrameCallback.bind(candidate)
      : null;
  return { request, cancel };
}

function watchVideoProgress(
  peer: RTCPeerConnection,
  video: HTMLVideoElement,
  onStall: () => void,
): () => void {
  const frameCallback = videoFrameCallbackApi(video);
  let stopped = false;
  let lastProgressAt = Date.now();
  let frameCallbackHandle: number | null = null;
  let lastPresentedFrames = 0;
  let lastCurrentTime = video.currentTime;

  const markProgress = () => {
    lastProgressAt = Date.now();
  };
  const stalled = () =>
    Date.now() - lastProgressAt >= webrtcFrameProgressTimeoutMs &&
    (peer.connectionState === "connected" ||
      peer.iceConnectionState === "connected" ||
      peer.iceConnectionState === "completed");
  const failIfStalled = () => {
    if (!stopped && stalled()) {
      onStall();
    }
  };

  const interval = window.setInterval(() => {
    if (frameCallback.request) {
      failIfStalled();
      return;
    }
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.currentTime !== lastCurrentTime
    ) {
      lastCurrentTime = video.currentTime;
      markProgress();
    }
    failIfStalled();
  }, 1_000);

  const requestNextFrame = () => {
    if (stopped || !frameCallback.request) {
      return;
    }
    frameCallbackHandle = frameCallback.request((_now, metadata) => {
      if (stopped) {
        return;
      }
      const presentedFrames = metadata.presentedFrames ?? 0;
      if (
        presentedFrames > lastPresentedFrames ||
        metadata.mediaTime !== undefined
      ) {
        lastPresentedFrames = presentedFrames;
        markProgress();
      }
      requestNextFrame();
    });
  };
  requestNextFrame();

  const onEnded = () => onStall();
  const onPause = () => failIfStalled();
  for (const track of videoTracks(video)) {
    track.addEventListener("ended", onEnded);
    track.addEventListener("mute", onPause);
  }

  return () => {
    stopped = true;
    window.clearInterval(interval);
    if (frameCallbackHandle !== null && frameCallback.cancel) {
      frameCallback.cancel(frameCallbackHandle);
    }
    for (const track of videoTracks(video)) {
      track.removeEventListener("ended", onEnded);
      track.removeEventListener("mute", onPause);
    }
  };
}

function reportConnectionFailure(
  peer: RTCPeerConnection,
  reject: (error: Error) => void,
): void {
  const fail = () => {
    if (
      peer.connectionState === "failed" ||
      peer.connectionState === "closed" ||
      peer.iceConnectionState === "failed" ||
      peer.iceConnectionState === "closed"
    ) {
      reject(
        new Error(
          `WebRTC connection ${peer.connectionState}/${peer.iceConnectionState}.`,
        ),
      );
    }
  };
  peer.addEventListener("connectionstatechange", fail);
  peer.addEventListener("iceconnectionstatechange", fail);
}

function watchConnectionFailure(peer: RTCPeerConnection): Promise<never> {
  return new Promise((_, reject) => {
    reportConnectionFailure(peer, reject);
  });
}

function showVideoAfterFirstFrame(
  video: HTMLVideoElement,
  ui: ViewerUi,
): Promise<void> {
  return waitForFirstVideoFrame(video).then(() => {
    ui.showVideo();
  });
}

function waitForActiveVideo(
  peer: RTCPeerConnection,
  video: HTMLVideoElement,
  ui: ViewerUi,
): Promise<void> {
  return Promise.race([
    showVideoAfterFirstFrame(video, ui),
    watchConnectionFailure(peer),
  ]);
}

function waitForTrack(
  connection: RTCPeerConnection,
  video: HTMLVideoElement,
  audioRequested: boolean,
): Promise<void> {
  const mediaStream = new MediaStream();
  video.srcObject = mediaStream;
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC connected but no video track arrived."));
    }, 6000);
    const cleanup = () => {
      clearTimeout(timeout);
      connection.removeEventListener("track", onTrack);
    };
    const onTrack = (event: RTCTrackEvent) => {
      const [stream] = event.streams;
      if (stream) {
        video.srcObject = stream;
      } else {
        mediaStream.addTrack(event.track);
      }
      if (event.track.kind === "video") {
        void playVideoWithAutoplayFallback(video, audioRequested);
        cleanup();
        resolve();
      }
    };
    connection.addEventListener("track", onTrack);
  });
}

async function playVideoWithAutoplayFallback(
  video: HTMLVideoElement,
  audioRequested: boolean,
): Promise<void> {
  video.muted = !audioRequested;
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play().catch(() => undefined);
  }
}

function waitForConnectedTrackAndFrame(
  connection: RTCPeerConnection,
  video: HTMLVideoElement,
  ui: ViewerUi,
  trackReady: Promise<void>,
): Promise<void> {
  return waitForConnected(connection)
    .then(() => trackReady)
    .then(() => waitForActiveVideo(connection, video, ui));
}

function createPeerFailureHandler(
  getPeer: () => RTCPeerConnection | null,
  fallback: () => void,
) {
  let handled = false;
  return () => {
    if (handled) {
      return;
    }
    const activePeer = getPeer();
    if (!activePeer) {
      return;
    }
    if (
      activePeer.connectionState === "failed" ||
      activePeer.connectionState === "closed" ||
      activePeer.iceConnectionState === "failed" ||
      activePeer.iceConnectionState === "closed"
    ) {
      handled = true;
      fallback();
    }
  };
}

function attachPeerFailureFallback(
  peer: RTCPeerConnection,
  getPeer: () => RTCPeerConnection | null,
  fallback: () => void,
): void {
  const handleFailure = createPeerFailureHandler(getPeer, fallback);
  peer.addEventListener("connectionstatechange", handleFailure);
  peer.addEventListener("iceconnectionstatechange", handleFailure);
}

export function createWebrtcStream({
  config,
  video,
  controlChannel,
  ui,
  lifecycle,
  fallback,
}: WebrtcStreamOptions) {
  let peer: RTCPeerConnection | null = null;
  let fallbackStarted = false;
  let stopFrameProgressMonitor: (() => void) | null = null;

  video.addEventListener(
    "pointerdown",
    () => {
      if (config.audio) {
        video.muted = false;
      }
      void video.play().catch(() => undefined);
    },
    { passive: true },
  );

  const startFallback = () => {
    if (fallbackStarted || lifecycle.isClosing()) {
      return;
    }
    fallbackStarted = true;
    stopFrameProgressMonitor?.();
    stopFrameProgressMonitor = null;
    const activePeer = peer;
    peer = null;
    closePeer(activePeer, video);
    fallback();
  };

  lifecycle.onClose(() => {
    stopFrameProgressMonitor?.();
    stopFrameProgressMonitor = null;
    closePeer(peer, video);
  });

  async function connect(): Promise<void> {
    if (!config.sessionId || !config.token) {
      fallback();
      return;
    }
    if (!("RTCPeerConnection" in window)) {
      fallback();
      return;
    }

    ui.showStatus(
      "Starting WebRTC...",
      "Starting live display",
      "Rebroid is opening the app screen.",
    );
    const connection = new RTCPeerConnection();
    peer = connection;
    fallbackStarted = false;
    attachPeerFailureFallback(connection, () => peer, startFallback);
    const channel = connection.createDataChannel("rebroid-control", {
      ordered: true,
    });
    controlChannel.useDataChannel(channel);
    connection.addTransceiver("video", { direction: "recvonly" });
    if (config.audio) {
      connection.addTransceiver("audio", { direction: "recvonly" });
    }
    video.muted = !config.audio;

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIceGathering(connection);
    const trackReady = waitForTrack(connection, video, config.audio);

    const response = await fetch(
      `/rebroid/display/public/sessions/${encodeURIComponent(config.sessionId)}/webrtc/offer`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: config.token,
          sdp: connection.localDescription?.sdp ?? offer.sdp,
          bitrate: Number(
            config.params.get("bitrate") ?? config.streamDefaults.bitrate,
          ),
          maxFps: Number(
            config.params.get("maxFps") ?? config.streamDefaults.maxFps,
          ),
          maxSize: Number(
            config.params.get("maxSize") ?? config.streamDefaults.maxSize,
          ),
          iFrameInterval: Number(
            config.params.get("iFrameInterval") ??
              config.streamDefaults.iFrameInterval,
          ),
          audio: config.audio,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`WebRTC offer failed: ${response.status}`);
    }
    const answer = (await response.json()) as WebrtcAnswer;
    if (!answer.sdp) {
      throw new Error("WebRTC answer was missing SDP.");
    }
    await connection.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    await waitForConnectedTrackAndFrame(connection, video, ui, trackReady);
    stopFrameProgressMonitor?.();
    stopFrameProgressMonitor = watchVideoProgress(connection, video, () => {
      console.warn("WebRTC video stopped advancing; falling back.");
      startFallback();
    });
  }

  return {
    connect,
    scheduleReconnect() {
      startFallback();
    },
  };
}
