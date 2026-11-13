import assert from "node:assert/strict";
import { test } from "node:test";
import { Logger } from "@nestjs/common";
import { scrcpyVideoConfigurationChangedCloseCode } from "../scrcpy/scrcpy.types";
import type {
  ScrcpyMediaSink,
  ScrcpyStreamAttachment,
  ScrcpyVideoBootstrap,
} from "../scrcpy/scrcpy.types";
import { DisplayWebrtcAttempt } from "./display-webrtc-attempt";
import type {
  WebrtcBridge,
  WebrtcBridgeMessage,
} from "./display-webrtc-bridge";

test("codec change notifies the current peer before bounded shutdown and fences retired controls", async (t) => {
  const debug = t.mock.method(Logger.prototype, "debug", () => undefined);
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
  let bridgeAttemptId: string | undefined;
  const replies: unknown[] = [];
  let mediaSink: ScrcpyMediaSink | undefined;
  let finishMedia!: () => void;
  const mediaClosed = new Promise<void>((resolve) => {
    finishMedia = resolve;
  });
  const bridgeCloseListeners: Array<() => void> = [];
  let finishBridge!: () => void;
  const bridgeClosed = new Promise<void>((resolve) => {
    finishBridge = resolve;
  });
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
    attachMedia: (sink) => {
      attached += 1;
      mediaSink = sink;
      return {
        ...stream,
        consumerId: "media",
        closed: mediaClosed,
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
    onClose: (listener) => bridgeCloseListeners.push(listener),
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
      bridgeCloseListeners.forEach((listener) => listener());
      finishBridge();
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
    attachSource: () => stream,
    launchBridge: (_signal, attemptId) => {
      bridgeAttemptId = attemptId;
      return bridge;
    },
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
    const response = await answer;
    assert.equal(response.sdp, "answer");
    assert.equal(response.consumerAttemptId, bridgeAttemptId);
    assert.equal(attached, 1);
    const profile = replies.find(
      (reply) => (reply as Record<string, unknown>).type === "webrtc-profile",
    ) as Record<string, unknown>;
    assert.equal(profile.sourceAttemptId, "source");
    assert.match(String(profile.consumerAttemptId), /^[0-9a-f-]{36}$/);
    assert.equal(detachedBootstrap, 1);

    onMessage({
      type: "control",
      payload: { id: "command", type: "keyboard" },
    });
    assert.equal(dispatchedControls, 1);
    assert.ok(mediaSink);
    mediaSink.close(
      scrcpyVideoConfigurationChangedCloseCode,
      "UPSTREAM_SENSITIVE_DETAIL",
    );
    finishMedia();
    await Promise.resolve();
    assert.equal(closed, 0, "allow time to deliver the notice over SCTP");
    assert.deepEqual(replies.at(-1), {
      type: "webrtc-codec-changed",
      consumerAttemptId: profile.consumerAttemptId,
    });
    onMessage({ type: "control", payload: { id: "stale", type: "keyboard" } });
    onMessage({ type: "video-resync-request" });
    assert.equal(dispatchedControls, 1);
    assert.equal(resetRequests, 0);
    // No browser response. The sidecar must still retire the peer promptly.
    const deadline = setTimeout(() => {}, 1_000);
    try {
      await bridgeClosed;
    } finally {
      clearTimeout(deadline);
    }
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
    const terminalLogs = debug.mock.calls.flatMap(({ arguments: args }) =>
      args.filter(
        (message) =>
          typeof message === "string" && message.includes("attempt ended"),
      ),
    );
    assert.deepEqual(terminalLogs, [
      `[webrtc:session:${response.consumerAttemptId}] attempt ended reason=source_codec_changed sourceAttemptId=source`,
    ]);
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
