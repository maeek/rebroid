import type { ViewerRelayMetrics } from "./types.js";

type ReadNumber = (value: unknown) => number | undefined;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function coerceFiniteNumber(value: unknown): number | undefined {
  return finiteNumber(Number(value));
}

function readRelaySummary(
  metrics: Record<string, unknown>,
  readNumber: ReadNumber,
) {
  return {
    sourceFps: readNumber(metrics.sourceFps),
    droppedFrames: readNumber(metrics.droppedFrames),
    queueDepthMs: readNumber(metrics.queueDepthMs),
  };
}

function readRelayDiagnostics(
  metrics: Record<string, unknown>,
  readNumber: ReadNumber,
) {
  return {
    sourceBitrateMbps: readNumber(metrics.sourceBitrateMbps),
    sourceFrameSizeP95Bytes: readNumber(metrics.sourceFrameSizeP95Bytes),
    keyFrameSizeBytes: readNumber(metrics.keyFrameSizeBytes),
    sourceInterFrameP95Ms: readNumber(metrics.sourceInterFrameP95Ms),
    relayP95Ms: readNumber(metrics.relayP95Ms),
    relayP99Ms: readNumber(metrics.relayP99Ms),
    eventLoopUtilization: readNumber(metrics.eventLoopUtilization),
    gcPauseP95Ms: readNumber(metrics.gcPauseP95Ms),
  };
}

export function parseRelayMetrics(metrics: Record<string, unknown>) {
  return {
    ...readRelaySummary(metrics, finiteNumber),
    ...readRelayDiagnostics(metrics, finiteNumber),
  };
}

export function applyControlRelayMetrics(
  current: ViewerRelayMetrics | null,
  metrics: Record<string, unknown>,
): ViewerRelayMetrics | null {
  const { sourceFps, droppedFrames, queueDepthMs } = readRelaySummary(
    metrics,
    coerceFiniteNumber,
  );
  if (
    sourceFps === undefined ||
    droppedFrames === undefined ||
    queueDepthMs === undefined
  ) {
    return current;
  }
  return {
    ...current,
    sourceFps,
    sourceVideoFrames: coerceFiniteNumber(metrics.sourceVideoFrames),
    droppedFrames,
    queueDepthMs,
    ...readRelayDiagnostics(metrics, coerceFiniteNumber),
  };
}
