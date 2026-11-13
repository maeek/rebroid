import type { ViewerRelayMetrics } from "./types.js";

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

export function applyVideoRecoveryStatus(
  current: ViewerRelayMetrics | null,
  message: Record<string, unknown>,
): ViewerRelayMetrics | null {
  const sourceAttemptId = message.sourceAttemptId;
  if (typeof sourceAttemptId !== "string" || sourceAttemptId.length > 128)
    return current;
  if (message.type === "ready") {
    if (current?.sourceAttemptId === sourceAttemptId) return current;
    return {
      sourceFps: 0,
      droppedFrames: 0,
      queueDepthMs: 0,
      sourceAttemptId,
      consumerAttemptId: current?.consumerAttemptId,
      negotiatedH264ProfileLevelId: current?.negotiatedH264ProfileLevelId,
      bridgeNackCount: current?.bridgeNackCount,
      bridgePliCount: current?.bridgePliCount,
      bridgePacketsLost: current?.bridgePacketsLost,
      bridgeRoundTripTimeMs: current?.bridgeRoundTripTimeMs,
      bridgeInputFps: current?.bridgeInputFps,
      rtpSentFps: current?.rtpSentFps,
      rtpPacketizationP95Ms: current?.rtpPacketizationP95Ms,
      rtpWriteP95Ms: current?.rtpWriteP95Ms,
      rtpSendErrors: current?.rtpSendErrors,
      retransmittedPackets: current?.retransmittedPackets,
      retransmittedBytes: current?.retransmittedBytes,
      packetsDiscardedOnSend: current?.packetsDiscardedOnSend,
      rtpSendDelayMs: current?.rtpSendDelayMs,
    };
  }
  if (message.type !== "video-reset" && message.type !== "video-reset-complete")
    return current;
  if (!current || current.sourceAttemptId !== sourceAttemptId) return current;
  const generation = count(message.generation);
  const codecGeneration = count(message.codecGeneration);
  const resetCount = count(message.count);
  if (
    generation === undefined ||
    codecGeneration === undefined ||
    resetCount === undefined
  )
    return current;
  if (message.type === "video-reset") {
    if (generation <= (current.videoResetGeneration ?? -1)) return current;
    return {
      ...current,
      sourceCodecGeneration: codecGeneration,
      videoResetGeneration: generation,
      videoResetCount: resetCount,
      videoResetCompletedGeneration: undefined,
      videoResetElapsedMs: undefined,
    };
  }
  if (generation !== current.videoResetGeneration) return current;
  const elapsedMs = count(message.elapsedMs);
  if (elapsedMs === undefined) return current;
  return {
    ...current,
    sourceCodecGeneration: codecGeneration,
    videoResetCompletedGeneration: generation,
    videoResetElapsedMs: elapsedMs,
  };
}
