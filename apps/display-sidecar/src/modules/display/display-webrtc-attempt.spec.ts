import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ScrcpyStreamAttachment,
  ScrcpyVideoBootstrap,
} from "../scrcpy/scrcpy.types";
import { DisplayWebrtcAttempt } from "./display-webrtc-attempt";
import type {
  WebrtcBridge,
  WebrtcBridgeMessage,
} from "./display-webrtc-bridge";

test("an offer gates media on the answer and fences bridge callbacks after stop", async () => {
  let onMessage: (message: WebrtcBridgeMessage) => void = () => {
    throw new Error("Bridge is not listening");
  };
  let onOffer!: () => void;
  const offerSent = new Promise<void>((resolve) => {
    onOffer = resolve;
  });
  let rejectControl!: (error: Error) => void;
  const control = new Promise<never>((_, reject) => {
    rejectControl = reject;
  });
  let attached = 0;
  let detachedBootstrap = 0;
  let detachedMedia = 0;
  let closed = 0;
  let finished = 0;
  let dispatchedControls = 0;
  let resetRequests = 0;
  const replies: unknown[] = [];
  const stream: ScrcpyStreamAttachment = {
    sourceAttemptId: "source",
    consumerId: "bootstrap",
    closed: new Promise(() => {}),
    detach: () => {
      detachedBootstrap += 1;
    },
    requestVideoReset: () => false,
    awaitVideoBootstrap: async () => bootstrap,
  };
  const bootstrap: ScrcpyVideoBootstrap = {
    isCurrent: () => true,
    attachMedia: () => {
      attached += 1;
      return {
        ...stream,
        consumerId: "media",
        detach: () => {
          detachedMedia += 1;
        },
        requestVideoReset: () => {
          resetRequests += 1;
          return true;
        },
      };
    },
    configuration: Buffer.alloc(0),
    keyFrame: Buffer.alloc(0),
    configurationTimestampUs: 0n,
    keyFrameTimestampUs: 1n,
    profileLevelId: "42c033",
    sdpFmtpLine: "packetization-mode=1;profile-level-id=42c033",
    width: 640,
    height: 480,
  };
  const bridge: WebrtcBridge = {
    isOpen: () => closed === 0,
    onClose: () => undefined,
    listen: (callbacks) => {
      onMessage = callbacks.onMessage;
    },
    sendOffer: () => onOffer(),
    sendDataChannel: (message) => {
      replies.push(message);
    },
    writeVideo: async () => undefined,
    writeAudio: async () => undefined,
    stopAudio: () => undefined,
    close: () => {
      closed += 1;
    },
  };
  const attempt = new DisplayWebrtcAttempt({
    allowClipboard: false,
    sessionId: "session",
    sdp: [
      "m=video 9 UDP/TLS/RTP/SAVPF 96",
      "a=rtpmap:96 H264/90000",
      "a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
    ].join("\r\n"),
    iceHost: "localhost",
    maxFps: 30,
    audio: false,
    iceServers: [],
    udpPortRange: "",
    assertSourceSupported: async () => undefined,
    attachSource: () => stream,
    launchBridge: () => bridge,
    executeControl: () => {
      dispatchedControls += 1;
      return control;
    },
    onFinish: () => {
      finished += 1;
    },
  });

  try {
    const answer = attempt.run();
    await offerSent;
    onMessage({ type: "state", state: "connected" });
    assert.equal(attached, 0);
    onMessage({ type: "answer", sdp: "answer" });
    assert.equal((await answer).sdp, "answer");
    assert.equal(attached, 1);
    assert.equal(detachedBootstrap, 1);

    onMessage({
      type: "control",
      payload: { id: "command", type: "keyboard" },
    });
    assert.equal(dispatchedControls, 1);
    attempt.stop();
    onMessage({ type: "state", state: "connected" });
    onMessage({ type: "video-resync-request" });
    onMessage({ type: "control", payload: { id: "late", type: "keyboard" } });
    rejectControl(new Error("late reply"));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(attached, 1);
    assert.equal(detachedMedia, 1);
    assert.equal(closed, 1);
    assert.equal(finished, 1);
    assert.equal(dispatchedControls, 1);
    assert.equal(resetRequests, 0);
    assert.equal(
      replies.some(
        (reply) => reply && typeof reply === "object" && "id" in reply,
      ),
      false,
    );
  } finally {
    attempt.stop();
  }
});
