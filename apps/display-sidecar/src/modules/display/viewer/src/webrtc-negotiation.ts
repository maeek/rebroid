import type { ViewerConfig } from "./types.js";
import { displayRequestPath } from "./config.js";

export class PermanentWebrtcError extends Error {}
export class WebrtcSessionExpiredError extends PermanentWebrtcError {}

export function preferH264PacketizationModeOne(
  transceiver: RTCRtpTransceiver,
): void {
  const codecs = RTCRtpReceiver.getCapabilities("video")?.codecs.filter(
    (codec) =>
      codec.mimeType.toLowerCase() === "video/h264" &&
      /(?:^|;)\s*packetization-mode=1(?:;|$)/i.test(codec.sdpFmtpLine ?? ""),
  );
  if (!codecs?.length || !transceiver.setCodecPreferences) {
    return;
  }
  transceiver.setCodecPreferences(codecs);
}

export function waitForIceGathering(
  peer: RTCPeerConnection,
  signal: AbortSignal,
): Promise<void> {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", checkState);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const checkState = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const timeout = window.setTimeout(finish, 1_500);
    peer.addEventListener("icegatheringstatechange", checkState);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

export function waitForConnected(
  peer: RTCPeerConnection,
  signal: AbortSignal,
): Promise<void> {
  if (
    peer.connectionState === "connected" ||
    peer.iceConnectionState === "connected" ||
    peer.iceConnectionState === "completed"
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("WebRTC did not connect in time."));
    }, 6_000);
    const cleanup = () => {
      clearTimeout(timeout);
      peer.removeEventListener("connectionstatechange", checkState);
      peer.removeEventListener("iceconnectionstatechange", checkState);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
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
    signal.addEventListener("abort", onAbort, { once: true });
    checkState();
  });
}

export async function requestWebrtcAnswer(
  sessionId: string,
  config: ViewerConfig,
  viewerId: string,
  sdp: string | undefined,
  signal: AbortSignal,
) {
  const response = await fetch(
    displayRequestPath(
      `/rebroid/display/public/sessions/${encodeURIComponent(sessionId)}/webrtc/offer`,
    ),
    {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-rebroid-viewer-id": viewerId,
      },
      body: JSON.stringify({
        sdp: sdp,
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
    let detail = `WebRTC offer failed: ${response.status}`;
    let code: unknown;
    try {
      const payload = (await response.json()) as {
        code?: unknown;
        message?: unknown;
      };
      if (typeof payload.message === "string") {
        detail = payload.message;
      }
      if (typeof payload.code === "string") {
        code = payload.code;
        detail = `${payload.code}: ${detail}`;
      }
    } catch {
      // Keep the bounded HTTP status diagnostic.
    }
    if (response.status === 409 && code === "feature_disabled") {
      return { transport: "websocket" } as const;
    }
    if (response.status === 404 && code === "display_session_unavailable") {
      throw new WebrtcSessionExpiredError(detail);
    }
    if (
      response.status >= 400 &&
      response.status < 500 &&
      code !== "display_profile_in_use"
    ) {
      throw new PermanentWebrtcError(detail);
    }
    throw new Error(detail);
  }
  const attemptId = response.headers?.get("x-rebroid-webrtc-attempt");
  const answer = (await response.json()) as {
    sdp?: string;
    profileLevelId?: string;
  };
  if (!answer.sdp) {
    throw new Error("WebRTC answer was missing SDP.");
  }
  return {
    transport: "webrtc",
    sdp: answer.sdp,
    profileLevelId: answer.profileLevelId,
    attemptId:
      attemptId && /^[a-z0-9-]{1,64}$/i.test(attemptId) ? attemptId : undefined,
    canControl: response.headers?.get("x-rebroid-viewer-control") !== "0",
  } as const;
}
