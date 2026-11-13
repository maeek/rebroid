import assert from "node:assert/strict";
import test from "node:test";
import { createWebrtcStream } from "../dist/modules/display/viewer/assets/webrtc-stream.js";

test("WebRTC suspends hidden offers, media, and retries and resumes once", async (t) => {
  const peers = [];
  const offers = [];
  const statuses = [];
  const closeListeners = new Set();
  const demandListeners = new Set();
  const presentationListeners = new Set();
  const retries = new Map();
  const metricTimers = new Set();
  let demand = false;
  let closing = false;
  let compact = false;
  let preserved = 0;
  let shown = 0;
  const stoppedTracks = [];
  const lifecycle = {
    isClosing: () => closing,
    hasDemand: () => demand,
    onClose: (callback) => closeListeners.add(callback),
    onDemandChange: (callback) => {
      demandListeners.add(callback);
      return () => demandListeners.delete(callback);
    },
  };
  const show = (value) => {
    demand = value;
    for (const listener of demandListeners) listener(value);
  };
  const setCompact = (value) => {
    compact = value;
    for (const listener of presentationListeners) listener(value);
  };
  const video = Object.assign(new EventTarget(), {
    readyState: 0,
    srcObject: null,
    play: async () => undefined,
    pause: () => undefined,
    removeAttribute: () => undefined,
  });
  class Stream {
    constructor() {
      this.track = Object.assign(new EventTarget(), {
        kind: "video",
        stop: () => stoppedTracks.push(this.track),
      });
    }

    getTracks() {
      return [this.track];
    }

    getVideoTracks() {
      return this.getTracks();
    }
  }
  class Peer extends EventTarget {
    connectionState = "new";
    iceConnectionState = "new";
    iceGatheringState = "complete";
    reliable = new EventTarget();

    constructor() {
      super();
      peers.push(this);
    }

    createDataChannel(name) {
      return name === "rebroid-control" ? this.reliable : new EventTarget();
    }

    addTransceiver() {
      return {};
    }

    async createOffer() {
      return { sdp: "offer" };
    }

    async setLocalDescription(offer) {
      this.localDescription = offer;
    }

    async setRemoteDescription() {
      this.connectionState = "connected";
      const stream = new Stream();
      this.dispatchEvent(
        Object.assign(new Event("track"), {
          receiver: {},
          track: stream.track,
          streams: [stream],
        }),
      );
      video.readyState = 2;
    }

    close() {
      this.connectionState = "closed";
      this.reliable.dispatchEvent(new Event("close"));
      this.dispatchEvent(new Event("connectionstatechange"));
    }
  }
  const globals = {
    window: {
      RTCPeerConnection: Peer,
      location: { origin: "https://rebroid.test" },
      parent: { postMessage: (event) => statuses.push(event) },
      setTimeout(callback, ms) {
        if (ms !== 300) return setTimeout(callback, ms);
        const retry = Symbol("retry");
        retries.set(retry, callback);
        return retry;
      },
      clearTimeout(timer) {
        if (!retries.delete(timer)) clearTimeout(timer);
      },
      setInterval() {
        const timer = Symbol("metric timer");
        metricTimers.add(timer);
        return timer;
      },
      clearInterval(timer) {
        metricTimers.delete(timer);
      },
    },
    RTCPeerConnection: Peer,
    RTCRtpReceiver: { getCapabilities: () => null },
    HTMLMediaElement: { HAVE_CURRENT_DATA: 2 },
    MediaStream: Stream,
    fetch: (_url, { signal, headers }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
        offers.push({
          signal,
          viewerId: headers["x-rebroid-viewer-id"],
          answer: () => resolve(Response.json({ sdp: "answer" })),
        });
      }),
  };
  const original = Object.fromEntries(
    Object.keys(globals).map((key) => [key, globalThis[key]]),
  );
  Object.assign(globalThis, globals);
  t.after(() => {
    closing = true;
    for (const listener of closeListeners) listener();
    Object.assign(globalThis, original);
  });
  const stream = createWebrtcStream({
    config: {
      sessionId: "session",
      audio: true,
      params: new URLSearchParams(),
      streamDefaults: {},
    },
    lifecycle,
    presentation: {
      isCompact: () => compact,
      onChange: (listener) => {
        presentationListeners.add(listener);
        return () => presentationListeners.delete(listener);
      },
    },
    video,
    controlChannel: { useDataChannels() {} },
    getRelayMetrics: () => null,
    ui: {
      showStatus() {},
      showVideo: () => shown++,
      showFailure: assert.fail,
      preserveVideoFrame: () => {
        if (video.readyState < 2) return false;
        preserved++;
        return true;
      },
    },
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  await stream.connect();
  stream.scheduleReconnect();
  assert.equal(peers.length, 0);
  assert.equal(offers.length, 0);
  show(true);
  show(true);
  await settle();
  assert.equal(offers.length, 1);
  show(false);
  assert.equal(offers[0].signal.aborted, true);
  assert.equal(peers[0].connectionState, "closed");
  offers[0].answer();
  await settle();
  assert.equal(shown, 0);
  assert.equal(retries.size, 0);

  show(true);
  await settle();
  assert.equal(offers.length, 2);
  offers[1].answer();
  await settle();
  assert.equal(shown, 1);
  assert.equal(metricTimers.size, 1);
  const playingStream = video.srcObject;
  assert.equal(video.muted, false);
  setCompact(true);
  assert.equal(video.muted, true);
  setCompact(false);
  assert.equal(video.muted, false);
  assert.equal(offers.length, 2);
  assert.equal(video.srcObject, playingStream);
  setCompact(true);
  show(false);
  assert.equal(preserved, 1);
  assert.equal(stoppedTracks.length, 1);
  assert.equal(video.srcObject, null);
  assert.equal(metricTimers.size, 0);
  assert.equal(retries.size, 0);
  assert.equal(
    statuses.some(({ code }) => code === "reconnecting"),
    false,
  );

  show(true);
  await settle();
  assert.equal(offers.length, 3);
  peers[2].reliable.dispatchEvent(new Event("close"));
  assert.equal(retries.size, 1);
  show(false);
  assert.equal(retries.size, 0);
  assert.equal(offers[2].signal.aborted, true);
  show(true);
  show(true);
  await settle();
  assert.equal(offers.length, 4);
  assert.equal(peers.length, 4);
  assert.match(offers[0].viewerId, /^[a-f0-9]{32}$/);
  assert.deepEqual(
    offers.map(({ viewerId }) => viewerId),
    Array(offers.length).fill(offers[0].viewerId),
  );
  offers[3].answer();
  await settle();
  assert.equal(video.muted, true);
});
