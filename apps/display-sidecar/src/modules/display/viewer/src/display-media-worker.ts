import { codecConfiguration } from "./h264.js";
import {
  FragmentedMp4Muxer,
  type FragmentedMp4Configuration,
  type FragmentedMp4Sample,
} from "./fragmented-mp4.js";
import { parseViewerMediaFrame, type ViewerMediaFrame } from "./media-frame.js";
import { MediaIngressQueue } from "./media-ingress-queue.js";
import { VideoProgressWatchdog } from "./video-progress-watchdog.js";
import {
  createVideoFrameRenderer,
  type VideoFrameRenderer,
} from "./video-frame-renderer.js";
import type { ViewerEffectiveProfile, ViewerStreamMetricsV4 } from "./types.js";

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

type WorkerInput =
  | {
      type: "init";
      url: string;
      canvas: OffscreenCanvas;
      audio: boolean;
      audioPort?: MessagePort;
      effectiveProfile: ViewerEffectiveProfile;
      renderer: "webcodecs" | "mse";
      visible?: boolean;
    }
  | { type: "reconnect"; cause: ReconnectCause }
  | { type: "visibility"; visible: boolean }
  | {
      type: "watermark";
      epoch: number;
      decodedSequence?: number;
      presentedSequence?: number;
      presentedTimestampUs?: number;
    }
  | { type: "mse-presented"; epoch: number }
  | { type: "mse-resync"; reason: string; epoch: number }
  | { type: "use-webcodecs-fallback" }
  | { type: "close" };

type WorkerOutput =
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
  | {
      type: "mse-segment";
      epoch: number;
      durationMs: number;
      sourcePtsOriginUs: number;
      samples: Array<{ sequence: number; timestampUs: number }>;
      segment: ArrayBuffer;
    }
  | { type: "renderer-fallback"; reason: string }
  | { type: "reconnecting"; cause: ReconnectCause; delayMs: number }
  | { type: "session-expired" }
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
const videoIngressLimits = {
  bytes: 16 * 1024 * 1024 + 24,
  frames: 8,
  ageMs: 150,
};
const audioIngressLimits = { bytes: 256 * 1024, frames: 8, ageMs: 150 };
const maxCodecConfigurationBytes = 256 * 1024;
const decoderProbeTimeoutMs = 1_500;

let canvas: OffscreenCanvas | null = null;
let renderer: VideoFrameRenderer | null = null;
let rendererMode: "webcodecs" | "mse" = "webcodecs";
let audioPort: MessagePort | null = null;
let audioRequested = false;
let audioPlaybackDisabled = false;
let websocketUrl = "";
let effectiveProfile: ViewerEffectiveProfile | null = null;
let ws: WebSocket | null = null;
let ingress: ReturnType<typeof createMediaIngress> | null = null;
let generation = 0;
let videoEpoch = 0;
let audioEpoch = 0;
let reconnectAttempt = 0;
let reconnectTimer = 0;
let firstFrameTimer = 0;
let mseRecoveryCount = 0;
let heartbeatTimer = 0;
let metricsTimer = 0;
let renderHandle = 0;
let closing = false;
let hasFrame = false;
let visible = true;
const videoProgress = new VideoProgressWatchdog();
let hasFrameInGeneration = false;
let width = 0;
let height = 0;
let decoder: VideoDecoder | null = null;
let decoderCodec: string | null = null;
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
let audioWorkletDroppedFrames = 0;
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
  decoderCodec = null;
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

function probeDecoder<T>(probe: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Display decoder capability check timed out."));
    }, decoderProbeTimeoutMs);
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
    };
    signal.addEventListener("abort", abort, { once: true });
    void probe.then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}

async function configureVideo(
  codec: string,
  expectedGeneration: number,
  signal: AbortSignal,
): Promise<boolean> {
  const epoch = videoEpoch;
  const isCurrent = () =>
    generation === expectedGeneration && videoEpoch === epoch && !closing;
  if (!isCurrent()) return false;
  if (decoder?.state === "configured" && decoderCodec === codec) {
    return true;
  }
  closeVideoDecoder();
  const config: VideoDecoderConfig = {
    codec,
    optimizeForLatency: true,
    hardwareAcceleration:
      decoderPreference === "hardware" ? "prefer-hardware" : "prefer-software",
  };
  try {
    const support = await probeDecoder(
      VideoDecoder.isConfigSupported(config),
      signal,
    );
    if (!isCurrent()) return false;
    if (!support.supported) {
      throw new Error(`Unsupported display decoder ${codec}.`);
    }
  } catch (error) {
    if (!isCurrent()) return false;
    throw error;
  }
  const configuredDecoder = new VideoDecoder({
    output(frame) {
      if (decoder !== configuredDecoder || videoEpoch !== epoch || closing) {
        frame.close();
        return;
      }
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
      if (decoder === configuredDecoder && videoEpoch === epoch && !closing) {
        localVideoRecovery(`decode-error:${error.message}`);
      }
    },
  });
  decoder = configuredDecoder;
  decoderCodec = codec;
  configuredDecoder.configure(config);
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
      epoch: videoEpoch,
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
      epoch: videoEpoch,
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

function enqueueMp4Sample(frame: ViewerMediaFrame): void {
  if (needsKeyFrame) {
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

function receiveVideoConfiguration(frame: ViewerMediaFrame): void {
  if (frame.data.byteLength > maxCodecConfigurationBytes) {
    throw new Error("H.264 configuration exceeds the viewer size limit.");
  }
  const next = codecConfiguration(frame.data);
  if (!next.sps || !next.pps) {
    throw new Error("H.264 configuration is missing SPS or PPS.");
  }
  resetVideoDecoderAdmission();
  cachedConfiguration = frame.data.slice();
  codecName = next.codec;
  mp4Configuration = null;
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
}

function recordVideoArrival(frame: ViewerMediaFrame, arrivalAt: number): void {
  receivedFrames += 1;
  highestReceivedSequence = frame.sequence;
  latestSourcePtsUs = Math.max(latestSourcePtsUs, frame.timestampUs);
  sourceAdvancedSinceDraw = true;
  if (lastArrivalAt !== null && lastReceivedPtsUs !== null) {
    const sourceGapMs =
      Math.max(0, frame.timestampUs - lastReceivedPtsUs) / 1_000;
    sourceGapsMs.push(sourceGapMs);
    networkJitterMs.push(Math.abs(arrivalAt - lastArrivalAt - sourceGapMs));
  }
  lastArrivalAt = arrivalAt;
  lastReceivedPtsUs = frame.timestampUs;
}

async function decodeVideo(
  frame: ViewerMediaFrame,
  expiresAt: number,
  expectedGeneration: number,
  signal: AbortSignal,
): Promise<void> {
  if (decoder && decoder.decodeQueueSize >= maxDecodeQueue) {
    decodeDroppedFrames += decoder.decodeQueueSize + 1;
    if (decoderPreference === "hardware" && !softwareDecoderFallbackUsed) {
      decoderPreference = "software";
      softwareDecoderFallbackUsed = true;
    }
    localVideoRecovery("decode-queue-overflow");
  }
  if (!cachedConfiguration || (needsKeyFrame && !frame.keyFrame)) {
    decodeDroppedFrames += 1;
    return;
  }
  if (rendererMode === "mse") {
    enqueueMp4Sample(frame);
    return;
  }
  const epoch = videoEpoch;
  if (!decoder || decoder.state !== "configured") {
    if (!codecName || !cachedConfiguration) {
      decodeDroppedFrames += 1;
      return;
    }
    if (!(await configureVideo(codecName, expectedGeneration, signal))) {
      return;
    }
  }
  if (generation !== expectedGeneration || videoEpoch !== epoch || closing) {
    return;
  }
  if (performance.now() >= expiresAt) {
    decodeDroppedFrames += 1;
    localVideoRecovery("video-ingress-age");
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
  if (!hasFrameInGeneration) {
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

function resetVideoAdmission(): void {
  videoEpoch += 1;
  needsKeyFrame = true;
  clearMp4FlushTimer();
  pendingMp4Samples = [];
  if (rendererMode === "mse")
    scope.postMessage({ type: "mse-reset", epoch: videoEpoch });
}

function resetVideoDecoderAdmission(): void {
  decodeDroppedFrames += ingress?.video.clear() ?? 0;
  resetVideoAdmission();
  closeVideoDecoder();
  if (pendingFrame) {
    pendingFrame.frame.close();
    pendingFrame = null;
    presentationDroppedFrames += 1;
  }
}

function localVideoRecovery(reason: string): void {
  resetVideoDecoderAdmission();
  requestVideoResync(reason);
}

function resetAudioAdmission(): void {
  audioDroppedFrames += ingress?.audio.clear() ?? 0;
  audioEpoch += 1;
  closeAudioDecoder();
  audioDiscontinuityPending = true;
}

function disableAudioPlayback(
  error: unknown,
  expectedGeneration: number,
): void {
  if (generation !== expectedGeneration || closing || audioPlaybackDisabled)
    return;
  audioPlaybackDisabled = true;
  resetAudioAdmission();
  resetAudioTimeline();
  scope.postMessage({
    type: "status",
    payload: {
      type: "audio-disabled",
      message:
        error instanceof Error
          ? error.message
          : "Audio playback failed in this browser.",
    },
  });
}

async function configureAudio(
  expectedGeneration: number,
  signal: AbortSignal,
): Promise<boolean> {
  const epoch = audioEpoch;
  const isCurrent = () =>
    generation === expectedGeneration && audioEpoch === epoch && !closing;
  if (!isCurrent()) return false;
  if (audioDecoder?.state === "configured") {
    return true;
  }
  closeAudioDecoder();
  if (typeof AudioDecoder === "undefined") {
    throw new Error(
      "This browser does not support live display audio decoding.",
    );
  }
  const config: AudioDecoderConfig = {
    codec: "opus",
    sampleRate: 48_000,
    numberOfChannels: 2,
    description: audioDescription,
  };
  try {
    const support = await probeDecoder(
      AudioDecoder.isConfigSupported(config),
      signal,
    );
    if (!isCurrent()) return false;
    if (!support.supported) {
      throw new Error("This browser cannot decode the live display audio.");
    }
  } catch (error) {
    if (!isCurrent()) return false;
    throw error;
  }
  const decoder = new AudioDecoder({
    output(audio) {
      if (audioDecoder !== decoder || !isCurrent()) {
        audio.close();
        return;
      }
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
      if (audioDecoder === decoder)
        disableAudioPlayback(error, expectedGeneration);
    },
  });
  audioDecoder = decoder;
  decoder.configure(config);
  return true;
}

async function decodeAudio(
  frame: ViewerMediaFrame,
  expiresAt: number,
  expectedGeneration: number,
  signal: AbortSignal,
): Promise<void> {
  if (audioPlaybackDisabled) return;
  if (audioDecoder && audioDecoder.decodeQueueSize >= 8) {
    audioDroppedFrames += audioDecoder.decodeQueueSize + 1;
    closeAudioDecoder();
    audioDiscontinuityPending = true;
  }
  const epoch = audioEpoch;
  if (!(await configureAudio(expectedGeneration, signal))) return;
  if (generation !== expectedGeneration || audioEpoch !== epoch || closing)
    return;
  if (performance.now() >= expiresAt) {
    audioDroppedFrames += 1;
    audioDiscontinuityPending = true;
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

function validateSequence(frame: ViewerMediaFrame): boolean {
  const previous = lastSequences.get(frame.kind);
  lastSequences.set(frame.kind, frame.sequence);
  if (previous === undefined) {
    return true;
  }
  return frame.sequence === (previous + 1) >>> 0;
}

function handleBinary(
  data: ArrayBuffer,
  connection: NonNullable<typeof ingress>,
): void {
  bytes += data.byteLength;
  const frame = parseViewerMediaFrame(data);
  const contiguous = validateSequence(frame);
  const receivedAt = performance.now();
  if (frame.kind === "video") {
    if (!contiguous) localVideoRecovery("rbd1-sequence-gap");
    if (frame.config) {
      receiveVideoConfiguration(frame);
      return;
    }
    recordVideoArrival(frame, receivedAt);
    if (frame.discontinuity) {
      if (!frame.keyFrame || !cachedConfiguration) {
        localVideoRecovery("rbd1-discontinuity");
      } else if (!needsKeyFrame) {
        resetVideoDecoderAdmission();
      }
    }
    if (!connection.video.offer(frame, receivedAt)) {
      localVideoRecovery("video-ingress-overflow");
      if (!frame.keyFrame || !connection.video.offer(frame, receivedAt)) {
        decodeDroppedFrames += 1;
      }
    }
    return;
  }

  if (!audioRequested || !audioPort || audioPlaybackDisabled) return;
  if (!contiguous || frame.discontinuity || frame.config) resetAudioAdmission();
  if (frame.config) {
    if (frame.data.byteLength > maxCodecConfigurationBytes) {
      disableAudioPlayback(
        new Error("Opus configuration exceeds the viewer size limit."),
        connection.generation,
      );
      return;
    }
    audioDescription = frame.data.slice();
    return;
  }
  if (!connection.audio.offer(frame, receivedAt)) {
    resetAudioAdmission();
    if (!connection.audio.offer(frame, receivedAt)) audioDroppedFrames += 1;
  }
}

function handleMediaError(error: unknown, expectedGeneration: number): void {
  if (generation !== expectedGeneration || closing) return;
  reconnect({
    initiator: "worker",
    category: "malformed-media",
    generation,
    detail: error instanceof Error ? error.message : String(error),
  });
}

function createMediaIngress(currentGeneration: number) {
  const controller = new AbortController();
  const video = new MediaIngressQueue(
    videoIngressLimits,
    (frame, expiresAt) =>
      decodeVideo(frame, expiresAt, currentGeneration, controller.signal),
    (dropped) => {
      decodeDroppedFrames += dropped;
      localVideoRecovery("video-ingress-age");
    },
    (error) => handleMediaError(error, currentGeneration),
  );
  const audio = new MediaIngressQueue(
    audioIngressLimits,
    (frame, expiresAt) =>
      decodeAudio(frame, expiresAt, currentGeneration, controller.signal),
    (dropped) => {
      audioDroppedFrames += dropped;
      resetAudioAdmission();
    },
    (error) => disableAudioPlayback(error, currentGeneration),
  );
  return {
    generation: currentGeneration,
    video,
    audio,
    close() {
      video.close();
      audio.close();
      controller.abort();
    },
  };
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function handleText(text: string): void {
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
    if (visible) videoProgress.observeSource(relaySourceFps, performance.now());
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
    videoProgress.reset();
    resetAudioAdmission();
    audioDescription = undefined;
    resetAudioTimeline();
    cachedConfiguration = null;
    codecName = null;
    mp4Configuration = null;
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
  videoProgress.reset();
  relaySourceFps = undefined;
  clearFirstFrameTimer();
  clearHeartbeatTimer();
  ingress?.close();
  ingress = null;
  closeVideoDecoder();
  closeAudioDecoder();
  audioPlaybackDisabled = false;
  audioDescription = undefined;
  cachedConfiguration = null;
  codecName = null;
  mp4Configuration = null;
  resetVideoAdmission();
  hasFrameInGeneration = false;
  lastSequences = new Map();
  lastResyncRequestAt = 0;
  lastArrivalAt = null;
  lastReceivedPtsUs = null;
  latestSourcePtsUs = 0;
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
  const requestedAt = performance.timeOrigin + performance.now();
  const socket = new WebSocket(websocketUrl);
  scope.postMessage({ type: "stream-requested", at: requestedAt });
  socket.binaryType = "arraybuffer";
  const connection = createMediaIngress(currentGeneration);
  ingress = connection;
  ws = socket;
  socket.addEventListener("open", () => {
    if (generation !== currentGeneration) {
      return;
    }
    markAlive();
    armFirstFrameTimer(currentGeneration);
  });
  socket.addEventListener("message", (event) => {
    if (ingress !== connection || closing) return;
    markAlive();
    try {
      if (typeof event.data === "string") {
        handleText(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        handleBinary(event.data, connection);
      } else {
        throw new Error("Display stream delivered a non-binary media frame.");
      }
    } catch (error) {
      handleMediaError(error, currentGeneration);
    }
  });
  socket.addEventListener("close", (event) => {
    if (generation !== currentGeneration || closing) {
      return;
    }
    if (event.code === 4404) {
      scope.postMessage({ type: "session-expired" });
      shutdown();
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

function checkVideoProgress(): void {
  if (!visible || !hasFrame || closing || ws?.readyState !== WebSocket.OPEN)
    return;
  const recovery = videoProgress.sample(
    {
      received: highestReceivedSequence,
      decoded: highestDecodedSequence,
      presented: highestPresentedSequence,
    },
    performance.now(),
  );
  if (recovery?.action === "reconnect") {
    reconnect({
      initiator: "worker",
      category: "video-progress",
      generation,
      detail: recovery.reason,
    });
  } else if (recovery?.action === "resync") {
    localVideoRecovery(recovery.reason);
  }
}

function emitMetrics(): void {
  checkVideoProgress();
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
      audioDroppedFrames: audioDroppedFrames + audioWorkletDroppedFrames,
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
  if (message.type === "visibility") {
    visible = message.visible;
    videoProgress.reset();
    return;
  }
  if (message.type === "reconnect") {
    reconnect(message.cause);
    return;
  }
  if (message.type === "watermark") {
    if (message.epoch !== videoEpoch || rendererMode !== "mse") return;
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
    if (message.epoch === videoEpoch) markMsePresented();
    return;
  }
  if (message.type === "mse-resync") {
    if (message.epoch === videoEpoch) handleMseResync(message.reason);
    return;
  }
  if (message.type === "use-webcodecs-fallback") {
    switchToWebCodecsFallback("mse-unsupported");
    return;
  }
  visible = message.visible ?? true;
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
        audioWorkletDroppedFrames = audioEvent.data.droppedFrames;
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
