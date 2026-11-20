type WebrtcReceiverTotals = {
  bytesReceived: number;
  framesReceived: number;
  framesDecoded: number;
  jitterBufferDelay: number;
  jitterBufferEmittedCount: number;
};

export type WebrtcIntervalSample = {
  receiver: WebrtcReceiverTotals;
  presentedFrames?: number;
  droppedFrames: number;
  sampledAt: number;
};

function metricReportNumber(
  report: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = report[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readWebrtcReceiverStats(
  stats: RTCStatsReport,
  previous: WebrtcReceiverTotals,
) {
  const receiver = { ...previous };
  let droppedFrames: number | undefined;
  let packetsLost: number | undefined;
  let nackCount: number | undefined;
  let pliCount: number | undefined;
  let networkJitterMs: number | undefined;
  let roundTripTimeMs: number | undefined;

  stats.forEach((report: RTCStats) => {
    const details = report as RTCStats & Record<string, unknown>;
    if (
      report.type === "inbound-rtp" &&
      details.kind === "video" &&
      details.isRemote !== true
    ) {
      receiver.bytesReceived =
        metricReportNumber(details, "bytesReceived") ?? receiver.bytesReceived;
      receiver.framesReceived =
        metricReportNumber(details, "framesReceived") ??
        receiver.framesReceived;
      receiver.framesDecoded =
        metricReportNumber(details, "framesDecoded") ?? receiver.framesDecoded;
      receiver.jitterBufferDelay =
        metricReportNumber(details, "jitterBufferDelay") ??
        receiver.jitterBufferDelay;
      receiver.jitterBufferEmittedCount =
        metricReportNumber(details, "jitterBufferEmittedCount") ??
        receiver.jitterBufferEmittedCount;
      droppedFrames = metricReportNumber(details, "framesDropped");
      packetsLost = metricReportNumber(details, "packetsLost");
      nackCount = metricReportNumber(details, "nackCount");
      pliCount = metricReportNumber(details, "pliCount");
      const jitterSeconds = metricReportNumber(details, "jitter");
      networkJitterMs =
        jitterSeconds === undefined ? undefined : jitterSeconds * 1_000;
    }
    if (
      (report.type === "candidate-pair" &&
        (details.selected === true || details.nominated === true)) ||
      report.type === "remote-inbound-rtp"
    ) {
      const seconds =
        metricReportNumber(details, "currentRoundTripTime") ??
        metricReportNumber(details, "roundTripTime");
      if (seconds !== undefined) roundTripTimeMs = seconds * 1_000;
    }
  });

  return {
    receiver,
    droppedFrames,
    packetsLost,
    nackCount,
    pliCount,
    networkJitterMs,
    roundTripTimeMs,
  };
}

export function calculateWebrtcIntervalMetrics(
  previous: WebrtcIntervalSample,
  current: WebrtcIntervalSample,
) {
  const elapsedSeconds = Math.max(
    (current.sampledAt - previous.sampledAt) / 1_000,
    0.001,
  );
  const jitterDelayDelta =
    current.receiver.jitterBufferDelay - previous.receiver.jitterBufferDelay;
  const jitterEmittedDelta =
    current.receiver.jitterBufferEmittedCount -
    previous.receiver.jitterBufferEmittedCount;
  const presentedFps =
    current.presentedFrames === undefined ||
    previous.presentedFrames === undefined
      ? undefined
      : (current.presentedFrames - previous.presentedFrames) / elapsedSeconds;

  return {
    receivedFps:
      (current.receiver.framesReceived - previous.receiver.framesReceived) /
      elapsedSeconds,
    decodedFps:
      (current.receiver.framesDecoded - previous.receiver.framesDecoded) /
      elapsedSeconds,
    presentedFps,
    wireBitrateMbps:
      ((current.receiver.bytesReceived - previous.receiver.bytesReceived) * 8) /
      elapsedSeconds /
      1_000_000,
    jitterQueueDepthMs:
      jitterEmittedDelta > 0
        ? (jitterDelayDelta / jitterEmittedDelta) * 1_000
        : undefined,
    droppedFramesDelta: Math.max(
      0,
      current.droppedFrames - previous.droppedFrames,
    ),
  };
}
