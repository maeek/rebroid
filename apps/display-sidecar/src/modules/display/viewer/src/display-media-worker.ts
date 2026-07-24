import { codecConfiguration } from "./h264.js";
import {
  FragmentedMp4Muxer,
  type FragmentedMp4Configuration,
  type FragmentedMp4Sample,
} from "./fragmented-mp4.js";
import { parseViewerMediaFrame } from "./media-frame.js";
import {
  createVideoFrameRenderer,
  type VideoFrameRenderer,
} from "./video-frame-renderer.js";
import type { ViewerEffectiveProfile, ViewerStreamMetricsV4 } from "./types.js";

type ReconnectCause = {
  initiator: "worker" | "main" | "transport";
  category: "heartbeat" | "first-frame" | "malformed-media" | "socket";
  generation: number;
  closeCode?: number;
  detail: string;
};

type WorkerInput =
  | {
      type: "init";
      url: string;
      canvas: OffscreenCanvas;
      audio: boolean;
      audioPort?: MessagePort;
      effectiveProfile: ViewerEffectiveProfile;
      renderer: "webcodecs" | "mse";
    }
  | { type: "reconnect"; cause: ReconnectCause }
  | {
      type: "watermark";
      decodedSequence?: number;
      presentedSequence?: number;
      presentedTimestampUs?: number;
    }
  | { type: "mse-presented" }
  | { type: "mse-resync"; reason: string }
  | { type: "use-webcodecs-fallback" }
  | { type: "close" };

type WorkerOutput =
  | { type: "first-frame" }
  | { type: "resolution"; width: number; height: number }
  | { type: "status"; payload: Record<string, unknown> }
  | { type: "metrics"; metrics: ViewerStreamMetricsV4 }
  | {
      type: "mse-init";
      codec: string;
      width: number;
      height: number;
      sourcePtsOriginUs: number;
      segment: ArrayBuffer;
    }
  | {
      type: "mse-segment";
      durationMs: number;
      sourcePtsOriginUs: number;
      samples: Array<{ sequence: number; timestampUs: number }>;
      segment: ArrayBuffer;
    }
  | { type: "renderer-fallback"; reason: string }
  | { type: "reconnecting"; cause: ReconnectCause; delayMs: number }
  | { type: "fatal"; message: string };

type AudioWorkletMessage =
  | { type: "playhead"; timestampUs: number; queueDepthMs: number }
  | { type: "audio-drops"; droppedFrames: number };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerInput>) => void) | null;
  postMessage: (message: WorkerOutput, transfer?: Transferable[]) => void;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  close: () => void;
};

const firstFrameTimeoutMs = 8_000;
const heartbeatTimeoutMs = 15_000;
const metricsIntervalMs = 1_000;
const maxDecodeQueue = 4;
const avSyncBoundUs = 80_000;

let canvas: OffscreenCanvas | null = null;
let renderer: VideoFrameRenderer | null = null;
let rendererMode: "webcodecs" | "mse" = "webcodecs";
let audioPort: MessagePort | null = null;
let audioRequested = false;
let websocketUrl = "";
let effectiveProfile: ViewerEffectiveProfile | null = null;
let ws: WebSocket | null = null;
let generation = 0;
let reconnectAttempt = 0;
let reconnectTimer = 0;
let firstFrameTimer = 0;
let mseRecoveryCount = 0;
let heartbeatTimer = 0;
let metricsTimer = 0;
let renderHandle = 0;
let closing = false;
let hasFrame = false;
let hasFrameInGeneration = false;
let width = 0;
let height = 0;
let decoder: VideoDecoder | null = null;
let audioDecoder: AudioDecoder | null = null;
let codecName: string | null = null;
let cachedConfiguration: Uint8Array<ArrayBufferLike> | null = null;
let audioDescription: Uint8Array<ArrayBufferLike> | undefined;
let needsKeyFrame = true;
let pendingFrame: {
  frame: VideoFrame;
  decodedAt: number;
  sequence: number;
} | null = null;
let lastSequences = new Map<string, number>();
let lastResyncRequestAt = 0;
let latestSourcePtsUs = 0;
let audioPlayheadUs: number | null = null;
let audioQueueDepthMs = 0;
let audioDiscontinuityPending = false;
let sourceAttemptId: string | undefined;

let bytes = 0;
let receivedFrames = 0;
let decodedFrames = 0;
let drawnFrames = 0;
let presentedFrames = 0;
let lastBytes = 0;
let lastReceivedFrames = 0;
let lastDecodedFrames = 0;
let lastDrawnFrames = 0;
let lastPresentedFrames = 0;
let lastMetricsAt = performance.now();
let lastArrivalAt: number | null = null;
let lastReceivedPtsUs: number | null = null;
let lastDrawAt: number | null = null;
let sourceAdvancedSinceDraw = false;
let relaySourceFps: number | undefined;
let sourceBitrateMbps: number | undefined;
let sourceFrameSizeP95Bytes: number | undefined;
let keyFrameSizeBytes: number | undefined;
let relaySourceInterFrameP95Ms: number | undefined;
let relayQueueDepthMs: number | undefined;
let relayP95Ms: number | undefined;
let relayP99Ms: number | undefined;
let eventLoopUtilization: number | undefined;
let gcPauseP95Ms: number | undefined;
let relayDroppedFrames = 0;
let decodeDroppedFrames = 0;
let presentationDroppedFrames = 0;
let audioDroppedFrames = 0;
let freezeCount = 0;
let reconnectCount = 0;
let resyncCount = 0;
let videoResetCount = 0;
let sourceRestartCount = 0;
let sourceGapsMs: number[] = [];
let networkJitterMs: number[] = [];
let decodeTimesMs: number[] = [];
let decodeToDrawMs: number[] = [];
let liveEdgeAgesMs: number[] = [];
let frameGapsMs: number[] = [];
const decodeStartedAt = new Map<number, number>();
const decodeSequences = new Map<number, number>();
let messageProcessing: Promise<void> = Promise.resolve();
let decoderPreference: "hardware" | "software" = "hardware";
let softwareDecoderFallbackUsed = false;
const mp4Muxer = new FragmentedMp4Muxer();
let mp4Configuration: FragmentedMp4Configuration | null = null;
let pendingMp4Samples: FragmentedMp4Sample[] = [];
let mp4FlushTimer = 0;
let highestReceivedSequence: number | undefined;
let highestDecodedSequence: number | undefined;
let highestPresentedSequence: number | undefined;

function percentile(
  values: number[],
  percentileValue: number,
): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1),
  );
  return sorted[index];
}

function sequenceLag(
  newest: number | undefined,
  older: number | undefined,
): number | undefined {
  if (newest === undefined || older === undefined) {
    return undefined;
  }
  return (newest - older) >>> 0;
}

function closeVideoDecoder(): void {
  try {
    decoder?.close();
  } catch {
    // WebCodecs may already have closed the decoder after an async failure.
  }
  decoder = null;
  decodeStartedAt.clear();
  decodeSequences.clear();
}

function closeAudioDecoder(): void {
  try {
    audioDecoder?.close();
  } catch {
    // WebCodecs may already have closed the decoder after an async failure.
  }
  audioDecoder = null;
}

async function configureVideo(
  codec: string,
  expectedGeneration: number,
): Promise<boolean> {
  if (generation !== expectedGeneration) {
    return false;
  }
  if (decoder?.state === "configured" && codecName === codec) {
    return true;
  }
  closeVideoDecoder();
  const config: VideoDecoderConfig = {
    codec,
    optimizeForLatency: true,
    hardwareAcceleration:
      decoderPreference === "hardware" ? "prefer-hardware" : "prefer-software",
  };
  const support = await VideoDecoder.isConfigSupported(config);
  if (generation !== expectedGeneration || closing) {
    return false;
  }
  if (!support.supported) {
    throw new Error(`Unsupported display decoder ${codec}.`);
  }
  decoder = new VideoDecoder({
    output(frame) {
      const decodedAt = performance.now();
      const startedAt = decodeStartedAt.get(frame.timestamp);
      const sequence = decodeSequences.get(frame.timestamp);
      decodeStartedAt.delete(frame.timestamp);
      decodeSequences.delete(frame.timestamp);
      if (startedAt !== undefined) {
        decodeTimesMs.push(decodedAt - startedAt);
      }
      decodedFrames += 1;
      highestDecodedSequence = sequence ?? highestDecodedSequence;
      if (
        audioPlayheadUs !== null &&
        frame.timestamp < audioPlayheadUs - avSyncBoundUs
      ) {
        presentationDroppedFrames += 1;
        frame.close();
        return;
      }
      if (
        audioPlayheadUs !== null &&
        frame.timestamp > audioPlayheadUs + avSyncBoundUs
      ) {
        resetAudioTimeline();
      }
      if (pendingFrame) {
        pendingFrame.frame.close();
        presentationDroppedFrames += 1;
      }
      pendingFrame = {
        frame,
        decodedAt,
        sequence: sequence ?? highestDecodedSequence ?? 0,
      };
      scheduleRender();
    },
    error(error) {
      localVideoRecovery(`decode-error:${error.message}`);
    },
  });
  decoder.configure(config);
  codecName = codec;
  return true;
}

function combinedRecoveryAccessUnit(
  media: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBufferLike> {
  if (!cachedConfiguration) {
    return media;
  }
  const combined = new Uint8Array(
    cachedConfiguration.byteLength + media.byteLength,
  );
  combined.set(cachedConfiguration, 0);
  combined.set(media, cachedConfiguration.byteLength);
  return combined;
}

function clearMp4FlushTimer(): void {
  if (mp4FlushTimer) {
    clearTimeout(mp4FlushTimer);
    mp4FlushTimer = 0;
  }
}

function postMp4Initialization(sourcePtsOriginUs: number): void {
  if (!mp4Configuration) {
    throw new Error("Firefox MSE is missing H.264 configuration.");
  }
  const initialization = mp4Muxer.initialize(mp4Configuration);
  const segment = initialization.segment;
  scope.postMessage(
    {
      type: "mse-init",
      codec: initialization.codec,
      width: initialization.width,
      height: initialization.height,
      sourcePtsOriginUs,
      segment,
    },
    [segment],
  );
  armFirstFrameTimer(generation);
}

function flushMp4Samples(nextTimestampUs?: number): void {
  clearMp4FlushTimer();
  if (pendingMp4Samples.length === 0) {
    return;
  }
  const samples = pendingMp4Samples.splice(
    0,
    Math.min(2, pendingMp4Samples.length),
  );
  const fragment = mp4Muxer.fragment(samples, nextTimestampUs);
  scope.postMessage(
    {
      type: "mse-segment",
      durationMs: fragment.durationMs,
      sourcePtsOriginUs: fragment.sourcePtsOriginUs,
      samples: fragment.samples,
      segment: fragment.segment,
    },
    [fragment.segment],
  );
  if (pendingMp4Samples.length > 0) {
    scheduleMp4Flush();
  }
}

function scheduleMp4Flush(): void {
  if (mp4FlushTimer || pendingMp4Samples.length === 0) {
    return;
  }
  mp4FlushTimer = setTimeout(() => {
    mp4FlushTimer = 0;
    flushMp4Samples();
  }, 33) as unknown as number;
}

function enqueueMp4Sample(
  frame: ReturnType<typeof parseViewerMediaFrame>,
): void {
  if (needsKeyFrame) {
    if (!frame.keyFrame) {
      decodeDroppedFrames += 1;
      return;
    }
    pendingMp4Samples = [];
    postMp4Initialization(frame.timestampUs);
    needsKeyFrame = false;
  }
  pendingMp4Samples.push({
    sequence: frame.sequence,
    timestampUs: frame.timestampUs,
    keyFrame: frame.keyFrame,
    data: frame.data,
  });
  if (pendingMp4Samples.length >= 3) {
    flushMp4Samples(pendingMp4Samples[2]!.timestampUs);
  } else {
    scheduleMp4Flush();
  }
}

async function decodeVideo(
  frame: ReturnType<typeof parseViewerMediaFrame>,
  expectedGeneration: number,
) {
  if (frame.config) {
    const next = codecConfiguration(frame.data);
    if (!next.sps || !next.pps) {
      throw new Error("H.264 configuration is missing SPS or PPS.");
    }
    cachedConfiguration = frame.data.slice();
    codecName = next.codec;
    if (next.width && next.height) {
      mp4Configuration = {
        codec: next.codec,
        sps: next.sps,
        pps: next.pps,
        width: next.width,
        height: next.height,
      };
      width = next.width;
      height = next.height;
    }
    if (effectiveProfile) {
      effectiveProfile.h264ProfileLevelId = next.profileLevelId;
      effectiveProfile.width = next.width;
      effectiveProfile.height = next.height;
      effectiveProfile.pixelRate =
        next.width && next.height
          ? next.width * next.height * effectiveProfile.maxFps
          : undefined;
    }
    if (rendererMode === "mse") {
      needsKeyFrame = true;
      pendingMp4Samples = [];
      clearMp4FlushTimer();
      return;
    }
    await configureVideo(next.codec, expectedGeneration);
    return;
  }
  receivedFrames += 1;
  highestReceivedSequence = frame.sequence;
  latestSourcePtsUs = Math.max(latestSourcePtsUs, frame.timestampUs);
  sourceAdvancedSinceDraw = true;
  const arrivalAt = performance.now();
  if (lastArrivalAt !== null && lastReceivedPtsUs !== null) {
    const sourceGapMs =
      Math.max(0, frame.timestampUs - lastReceivedPtsUs) / 1_000;
    sourceGapsMs.push(sourceGapMs);
    networkJitterMs.push(Math.abs(arrivalAt - lastArrivalAt - sourceGapMs));
  }
  lastArrivalAt = arrivalAt;
  lastReceivedPtsUs = frame.timestampUs;

  if (frame.discontinuity) {
    localVideoRecovery("rbd1-discontinuity");
  }
  if (rendererMode === "mse") {
    enqueueMp4Sample(frame);
    return;
  }
  if (decoder && decoder.decodeQueueSize >= maxDecodeQueue) {
    decodeDroppedFrames += decoder.decodeQueueSize + 1;
    if (decoderPreference === "hardware" && !softwareDecoderFallbackUsed) {
      decoderPreference = "software";
      softwareDecoderFallbackUsed = true;
    }
    localVideoRecovery("decode-queue-overflow");
  }
  if (needsKeyFrame && !frame.keyFrame) {
    decodeDroppedFrames += 1;
    return;
  }
  if (!decoder || decoder.state !== "configured") {
    if (!codecName || !cachedConfiguration) {
      decodeDroppedFrames += 1;
      return;
    }
    if (!(await configureVideo(codecName, expectedGeneration))) {
      return;
    }
  }
  if (generation !== expectedGeneration || closing) {
    return;
  }
  const data =
    needsKeyFrame && frame.keyFrame
      ? combinedRecoveryAccessUnit(frame.data)
      : frame.data;
  decodeStartedAt.set(frame.timestampUs, performance.now());
  decodeSequences.set(frame.timestampUs, frame.sequence);
  decoder?.decode(
    new EncodedVideoChunk({
      type: frame.keyFrame ? "key" : "delta",
      timestamp: frame.timestampUs,
      data,
    }),
  );
  if (frame.keyFrame) {
    needsKeyFrame = false;
  }
}

function scheduleRender(): void {
  if (renderHandle || !pendingFrame) {
    return;
  }
  const callback = () => {
    renderHandle = 0;
    drawPendingFrame();
  };
  if (scope.requestAnimationFrame) {
    renderHandle = scope.requestAnimationFrame(callback);
  } else {
    renderHandle = setTimeout(callback, 16) as unknown as number;
  }
}

function drawPendingFrame(): void {
  const pending = pendingFrame;
  pendingFrame = null;
  if (!pending || !canvas || !renderer) {
    pending?.frame.close();
    return;
  }
  const frameWidth = pending.frame.displayWidth || pending.frame.codedWidth;
  const frameHeight = pending.frame.displayHeight || pending.frame.codedHeight;
  if (width !== frameWidth || height !== frameHeight) {
    width = frameWidth;
    height = frameHeight;
    scope.postMessage({ type: "resolution", width, height });
  }
  renderer.draw(pending.frame, frameWidth, frameHeight);
  const drawnAt = performance.now();
  decodeToDrawMs.push(drawnAt - pending.decodedAt);
  liveEdgeAgesMs.push(
    Math.max(0, latestSourcePtsUs - pending.frame.timestamp) / 1_000,
  );
  pending.frame.close();
  drawnFrames += 1;
  presentedFrames += 1;
  highestPresentedSequence = pending.sequence;
  if (sourceAdvancedSinceDraw && lastDrawAt !== null) {
    const gap = drawnAt - lastDrawAt;
    frameGapsMs.push(gap);
    if (gap > 100) {
      freezeCount += 1;
    }
  }
  sourceAdvancedSinceDraw = false;
  lastDrawAt = drawnAt;
  if (!hasFrame) {
    hasFrame = true;
    reconnectAttempt = 0;
    scope.postMessage({ type: "first-frame" });
  }
  hasFrameInGeneration = true;
  reconnectAttempt = 0;
  clearFirstFrameTimer();
}

function requestVideoResync(reason: string): void {
  const now = performance.now();
  if (lastResyncRequestAt > 0 && now - lastResyncRequestAt < 1_000) {
    return;
  }
  lastResyncRequestAt = now;
  resyncCount += 1;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "video-resync-request",
        generation,
        reason: reason.slice(0, 120),
      }),
    );
  }
}

function localVideoRecovery(reason: string): void {
  closeVideoDecoder();
  clearMp4FlushTimer();
  pendingMp4Samples = [];
  needsKeyFrame = true;
  if (pendingFrame) {
    pendingFrame.frame.close();
    pendingFrame = null;
    presentationDroppedFrames += 1;
  }
  requestVideoResync(reason);
}

async function configureAudio(expectedGeneration: number): Promise<boolean> {
  if (generation !== expectedGeneration) {
    return false;
  }
  if (audioDecoder?.state === "configured") {
    return true;
  }
  closeAudioDecoder();
  const config: AudioDecoderConfig = {
    codec: "opus",
    sampleRate: 48_000,
    numberOfChannels: 2,
    description: audioDescription,
  };
  const support = await AudioDecoder.isConfigSupported(config);
  if (generation !== expectedGeneration || closing) {
    return false;
  }
  if (!support.supported) {
    throw new Error("This browser cannot decode the live display audio.");
  }
  audioDecoder = new AudioDecoder({
    output(audio) {
      const planes: ArrayBuffer[] = [];
      for (let channel = 0; channel < audio.numberOfChannels; channel += 1) {
        const plane = new Float32Array(audio.numberOfFrames);
        audio.copyTo(plane, { planeIndex: channel, format: "f32-planar" });
        planes.push(plane.buffer);
      }
      const timestampUs = audio.timestamp;
      const message = {
        type: "pcm",
        timestampUs,
        sampleRate: audio.sampleRate,
        numberOfFrames: audio.numberOfFrames,
        numberOfChannels: audio.numberOfChannels,
        discontinuity: audioDiscontinuityPending,
        planes,
      };
      audioDiscontinuityPending = false;
      audio.close();
      audioPort?.postMessage(message, planes);
    },
    error(error) {
      closeAudioDecoder();
      audioDiscontinuityPending = true;
      scope.postMessage({
        type: "status",
        payload: { type: "audio-disabled", message: error.message },
      });
    },
  });
  audioDecoder.configure(config);
  return true;
}

async function decodeAudio(
  frame: ReturnType<typeof parseViewerMediaFrame>,
  expectedGeneration: number,
) {
  if (!audioRequested || !audioPort) {
    return;
  }
  if (frame.config) {
    audioDescription = frame.data.slice();
    closeAudioDecoder();
    audioDiscontinuityPending = true;
    return;
  }
  if (frame.discontinuity) {
    closeAudioDecoder();
    audioDiscontinuityPending = true;
  }
  if (audioDecoder && audioDecoder.decodeQueueSize >= 8) {
    audioDroppedFrames += audioDecoder.decodeQueueSize + 1;
    closeAudioDecoder();
    audioDiscontinuityPending = true;
  }
  if (!(await configureAudio(expectedGeneration))) {
    return;
  }
  audioDecoder?.decode(
    new EncodedAudioChunk({
      type: "key",
      timestamp: frame.timestampUs,
      data: frame.data,
    }),
  );
}

function validateSequence(
  frame: ReturnType<typeof parseViewerMediaFrame>,
): boolean {
  const previous = lastSequences.get(frame.kind);
  lastSequences.set(frame.kind, frame.sequence);
  if (previous === undefined) {
    return true;
  }
  return frame.sequence === (previous + 1) >>> 0;
}

async function handleBinary(
  data: ArrayBuffer,
  expectedGeneration: number,
): Promise<void> {
  bytes += data.byteLength;
  const frame = parseViewerMediaFrame(data);
  if (!validateSequence(frame)) {
    if (frame.kind === "video") {
      localVideoRecovery("rbd1-sequence-gap");
    } else {
      closeAudioDecoder();
      audioDiscontinuityPending = true;
    }
  }
  if (frame.kind === "video") {
    await decodeVideo(frame, expectedGeneration);
  } else {
    await decodeAudio(frame, expectedGeneration);
  }
}

function enqueueMessage(
  expectedGeneration: number,
  task: () => void | Promise<void>,
): void {
  messageProcessing = messageProcessing
    .catch(() => undefined)
    .then(async () => {
      if (generation !== expectedGeneration || closing) {
        return;
      }
      await task();
    })
    .catch((error: unknown) => {
      if (generation !== expectedGeneration || closing) {
        return;
      }
      reconnect({
        initiator: "worker",
        category: "malformed-media",
        generation,
        detail: error instanceof Error ? error.message : String(error),
      });
    });
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function handleText(text: string): void {
  markAlive();
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      return;
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return;
  }
  if (payload.type === "heartbeat") {
    return;
  }
  if (payload.type === "relay-metrics" && payload.metrics) {
    const metrics = payload.metrics as Record<string, unknown>;
    relaySourceFps = numberField(metrics, "sourceFps");
    sourceBitrateMbps = numberField(metrics, "sourceBitrateMbps");
    sourceFrameSizeP95Bytes = numberField(metrics, "sourceFrameSizeP95Bytes");
    keyFrameSizeBytes = numberField(metrics, "keyFrameSizeBytes");
    relaySourceInterFrameP95Ms = numberField(metrics, "sourceInterFrameP95Ms");
    relayQueueDepthMs = numberField(metrics, "queueDepthMs");
    relayP95Ms = numberField(metrics, "relayP95Ms");
    relayP99Ms = numberField(metrics, "relayP99Ms");
    eventLoopUtilization = numberField(metrics, "eventLoopUtilization");
    gcPauseP95Ms = numberField(metrics, "gcPauseP95Ms");
    relayDroppedFrames = numberField(metrics, "droppedFrames") ?? 0;
    return;
  }
  if (payload.type === "ready") {
    const profile = payload.effectiveProfile;
    if (profile && typeof profile === "object" && effectiveProfile) {
      effectiveProfile = {
        ...effectiveProfile,
        ...(profile as Partial<ViewerEffectiveProfile>),
        transport: "websocket",
        actualEncoder:
          typeof payload.encoder === "string" ? payload.encoder : undefined,
        sourceAttemptId:
          typeof payload.sourceAttemptId === "string"
            ? payload.sourceAttemptId
            : undefined,
      };
      sourceAttemptId = effectiveProfile.sourceAttemptId;
    }
  } else if (payload.type === "encoder" && effectiveProfile) {
    effectiveProfile.actualEncoder =
      typeof payload.name === "string" ? payload.name : undefined;
  } else if (payload.type === "reconnecting") {
    sourceRestartCount += 1;
    resetAudioTimeline();
    localVideoRecovery("source-restarting");
  } else if (payload.type === "video-reset") {
    videoResetCount = numberField(payload, "count") ?? videoResetCount + 1;
  }
  scope.postMessage({ type: "status", payload });
}

function clearFirstFrameTimer(): void {
  if (firstFrameTimer) {
    clearTimeout(firstFrameTimer);
    firstFrameTimer = 0;
  }
}

function armFirstFrameTimer(expectedGeneration: number): void {
  clearFirstFrameTimer();
  firstFrameTimer = setTimeout(() => {
    firstFrameTimer = 0;
    if (generation !== expectedGeneration || closing) {
      return;
    }
    mseRecoveryCount += rendererMode === "mse" ? 1 : 0;
    if (rendererMode === "mse" && mseRecoveryCount >= 3) {
      switchToWebCodecsFallback("mse-first-frame-timeout");
      return;
    }
    localVideoRecovery("renderer-first-frame-timeout");
    scope.postMessage({
      type: "status",
      payload: {
        type: "renderer-recovering",
        renderer: rendererMode,
        message: "The video renderer is resynchronizing at the live edge.",
      },
    });
    armFirstFrameTimer(expectedGeneration);
  }, firstFrameTimeoutMs) as unknown as number;
}

function clearHeartbeatTimer(): void {
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = 0;
  }
}

function markAlive(): void {
  clearHeartbeatTimer();
  const currentGeneration = generation;
  heartbeatTimer = setTimeout(() => {
    heartbeatTimer = 0;
    if (generation === currentGeneration && !closing) {
      reconnect({
        initiator: "worker",
        category: "heartbeat",
        generation,
        detail: "Display stream stopped sending heartbeats.",
      });
    }
  }, heartbeatTimeoutMs) as unknown as number;
}

function resetConsumerState(): void {
  clearFirstFrameTimer();
  clearHeartbeatTimer();
  closeVideoDecoder();
  closeAudioDecoder();
  needsKeyFrame = true;
  clearMp4FlushTimer();
  pendingMp4Samples = [];
  hasFrameInGeneration = false;
  lastSequences = new Map();
  highestReceivedSequence = undefined;
  highestDecodedSequence = undefined;
  highestPresentedSequence = undefined;
  mseRecoveryCount = 0;
  audioDiscontinuityPending = true;
  resetAudioTimeline();
  if (pendingFrame) {
    pendingFrame.frame.close();
    pendingFrame = null;
  }
}

function markMsePresented(): void {
  if (rendererMode !== "mse") {
    return;
  }
  hasFrame = true;
  hasFrameInGeneration = true;
  reconnectAttempt = 0;
  clearFirstFrameTimer();
}

function switchToWebCodecsFallback(reason: string): void {
  if (rendererMode === "webcodecs" || !canvas) {
    return;
  }
  rendererMode = "webcodecs";
  renderer = createVideoFrameRenderer(canvas);
  hasFrame = false;
  hasFrameInGeneration = false;
  clearFirstFrameTimer();
  scope.postMessage({ type: "renderer-fallback", reason });
  localVideoRecovery(`mse-webcodecs-fallback:${reason}`);
  armFirstFrameTimer(generation);
}

function handleMseResync(reason: string): void {
  if (rendererMode !== "mse") {
    return;
  }
  mseRecoveryCount += 1;
  if (mseRecoveryCount >= 3) {
    switchToWebCodecsFallback(reason);
    return;
  }
  localVideoRecovery(reason);
  armFirstFrameTimer(generation);
}

function resetAudioTimeline(): void {
  audioPlayheadUs = null;
  audioQueueDepthMs = 0;
  audioPort?.postMessage({ type: "reset" });
}

function reconnect(cause: ReconnectCause): void {
  if (closing || reconnectTimer) {
    return;
  }
  reconnectCount += 1;
  const previous = ws;
  ws = null;
  generation += 1;
  resetConsumerState();
  if (
    previous?.readyState === WebSocket.OPEN ||
    previous?.readyState === WebSocket.CONNECTING
  ) {
    previous.close(4000, cause.detail.slice(0, 120));
  }
  const delayMs = Math.min(300 * 2 ** reconnectAttempt, 2_500);
  reconnectAttempt += 1;
  scope.postMessage({ type: "reconnecting", cause, delayMs });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = 0;
    connect();
  }, delayMs) as unknown as number;
}

function connect(): void {
  if (closing || !websocketUrl) {
    return;
  }
  const currentGeneration = ++generation;
  const socket = new WebSocket(websocketUrl);
  socket.binaryType = "arraybuffer";
  ws = socket;
  socket.addEventListener("open", () => {
    if (generation !== currentGeneration) {
      return;
    }
    markAlive();
    armFirstFrameTimer(currentGeneration);
  });
  socket.addEventListener("message", (event) => {
    if (generation !== currentGeneration) {
      return;
    }
    if (typeof event.data === "string") {
      markAlive();
      enqueueMessage(currentGeneration, () => handleText(event.data));
      return;
    }
    markAlive();
    if (!(event.data instanceof ArrayBuffer)) {
      reconnect({
        initiator: "worker",
        category: "malformed-media",
        generation,
        detail: "Display stream delivered a non-binary media frame.",
      });
      return;
    }
    enqueueMessage(currentGeneration, () =>
      handleBinary(event.data, currentGeneration),
    );
  });
  socket.addEventListener("close", (event) => {
    if (generation !== currentGeneration || closing) {
      return;
    }
    reconnect({
      initiator: "transport",
      category: "socket",
      generation,
      closeCode: event.code,
      detail: event.reason || "Display WebSocket closed.",
    });
  });
}

function emitMetrics(): void {
  if (!effectiveProfile) {
    return;
  }
  const now = performance.now();
  const elapsedSeconds = Math.max((now - lastMetricsAt) / 1_000, 0.001);
  const gaps = frameGapsMs;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "consumer-watermark",
        generation,
        receivedSequence: highestReceivedSequence,
        decodedSequence: highestDecodedSequence,
        presentedSequence: highestPresentedSequence,
      }),
    );
  }
  scope.postMessage({
    type: "metrics",
    metrics: {
      version: 4,
      transport: "websocket",
      sourceFps: relaySourceFps,
      relayIngressFps: relaySourceFps,
      receivedFps: (receivedFrames - lastReceivedFrames) / elapsedSeconds,
      decodedFps: (decodedFrames - lastDecodedFrames) / elapsedSeconds,
      drawnFps: (drawnFrames - lastDrawnFrames) / elapsedSeconds,
      presentedFps: (presentedFrames - lastPresentedFrames) / elapsedSeconds,
      wireBitrateMbps: ((bytes - lastBytes) * 8) / elapsedSeconds / 1_000_000,
      sourceBitrateMbps,
      sourceFrameSizeP95Bytes,
      keyFrameSizeBytes,
      frameGapP50Ms: percentile(gaps, 0.5),
      frameGapP95Ms: percentile(gaps, 0.95),
      frameGapP99Ms: percentile(gaps, 0.99),
      frameGapMaxMs: gaps.length > 0 ? Math.max(...gaps) : undefined,
      sourceInterFrameP95Ms:
        relaySourceInterFrameP95Ms ?? percentile(sourceGapsMs, 0.95),
      networkInterArrivalJitterP95Ms: percentile(networkJitterMs, 0.95),
      decodeP95Ms: percentile(decodeTimesMs, 0.95),
      decodeToDrawP95Ms: percentile(decodeToDrawMs, 0.95),
      liveEdgeAgeP95Ms: percentile(liveEdgeAgesMs, 0.95),
      relayQueueDepthMs,
      relayP95Ms,
      relayP99Ms,
      eventLoopUtilization,
      gcPauseP95Ms,
      decoderQueueDepth: decoder?.decodeQueueSize ?? 0,
      pendingRenderFrames: pendingFrame ? 1 : 0,
      audioQueueDepthMs,
      relayDroppedFrames,
      decodeDroppedFrames,
      presentationDroppedFrames,
      audioDroppedFrames,
      freezeCount,
      reconnectCount,
      resyncCount,
      videoResetCount,
      sourceRestartCount,
      highestReceivedSequence,
      highestDecodedSequence,
      highestPresentedSequence,
      presentationSequenceLag: sequenceLag(
        highestReceivedSequence,
        highestPresentedSequence,
      ),
      width: width || undefined,
      height: height || undefined,
      renderer:
        rendererMode === "mse"
          ? "firefox-mse"
          : (renderer?.backend ?? "chromium-webcodecs"),
      decoderPreference: rendererMode === "mse" ? "native" : decoderPreference,
      h264ProfileLevelId: effectiveProfile.h264ProfileLevelId,
      sourceAttemptId,
      consumerGeneration: generation,
      effectiveProfile,
      collectedAt: Date.now(),
    },
  });
  lastBytes = bytes;
  lastReceivedFrames = receivedFrames;
  lastDecodedFrames = decodedFrames;
  lastDrawnFrames = drawnFrames;
  lastPresentedFrames = presentedFrames;
  lastMetricsAt = now;
  sourceGapsMs = [];
  networkJitterMs = [];
  decodeTimesMs = [];
  decodeToDrawMs = [];
  liveEdgeAgesMs = [];
  frameGapsMs = [];
}

function shutdown(): void {
  closing = true;
  clearFirstFrameTimer();
  clearHeartbeatTimer();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  if (metricsTimer) {
    clearInterval(metricsTimer);
  }
  if (renderHandle && scope.cancelAnimationFrame) {
    scope.cancelAnimationFrame(renderHandle);
  }
  clearMp4FlushTimer();
  renderer?.close();
  renderer = null;
  ws?.close(1000, "viewer closed");
  ws = null;
  resetConsumerState();
  resetAudioTimeline();
  audioPort?.close();
  scope.close();
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === "close") {
    shutdown();
    return;
  }
  if (message.type === "reconnect") {
    reconnect(message.cause);
    return;
  }
  if (message.type === "watermark") {
    highestDecodedSequence = message.decodedSequence ?? highestDecodedSequence;
    highestPresentedSequence =
      message.presentedSequence ?? highestPresentedSequence;
    if (
      typeof message.presentedTimestampUs === "number" &&
      audioPlayheadUs !== null
    ) {
      const driftUs = message.presentedTimestampUs - audioPlayheadUs;
      if (driftUs > avSyncBoundUs) {
        resetAudioTimeline();
      } else if (driftUs < -avSyncBoundUs) {
        localVideoRecovery("mse-audio-video-drift");
      }
    }
    return;
  }
  if (message.type === "mse-presented") {
    markMsePresented();
    return;
  }
  if (message.type === "mse-resync") {
    handleMseResync(message.reason);
    return;
  }
  if (message.type === "use-webcodecs-fallback") {
    switchToWebCodecsFallback("mse-unsupported");
    return;
  }
  canvas = message.canvas;
  rendererMode = message.renderer;
  if (rendererMode === "webcodecs") {
    try {
      renderer = createVideoFrameRenderer(canvas);
    } catch (error) {
      scope.postMessage({
        type: "fatal",
        message:
          error instanceof Error
            ? error.message
            : "OffscreenCanvas is unavailable.",
      });
      return;
    }
  }
  websocketUrl = message.url;
  audioRequested = message.audio;
  audioPort = message.audioPort ?? null;
  effectiveProfile = message.effectiveProfile;
  audioPort?.addEventListener(
    "message",
    (audioEvent: MessageEvent<AudioWorkletMessage>) => {
      if (audioEvent.data.type === "playhead") {
        audioPlayheadUs = audioEvent.data.timestampUs;
        audioQueueDepthMs = audioEvent.data.queueDepthMs;
      } else {
        audioDroppedFrames = audioEvent.data.droppedFrames;
      }
    },
  );
  audioPort?.start();
  metricsTimer = setInterval(
    emitMetrics,
    metricsIntervalMs,
  ) as unknown as number;
  connect();
};
