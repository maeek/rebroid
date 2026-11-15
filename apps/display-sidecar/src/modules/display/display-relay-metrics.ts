import type { ScrcpyMediaSinkSnapshot } from "../scrcpy/scrcpy.types";

export function createRelayMetricsSampler(startedAt = Date.now()) {
  let previousAt = startedAt;
  let previousFrames = 0;
  let previousBytes = 0;

  return (snapshot: ScrcpyMediaSinkSnapshot, sampledAt: number) => {
    const elapsedSeconds = Math.max((sampledAt - previousAt) / 1_000, 0.001);
    const sourceBytes = snapshot.sourceVideoBytes ?? 0;
    const sourceFps =
      (snapshot.sourceVideoFrames - previousFrames) / elapsedSeconds;
    const sourceBitrateMbps =
      ((sourceBytes - previousBytes) * 8) / elapsedSeconds / 1_000_000;
    previousAt = sampledAt;
    previousFrames = snapshot.sourceVideoFrames;
    previousBytes = sourceBytes;

    return {
      sourceFps,
      sourceBitrateMbps,
      sourceFrameSizeP95Bytes: snapshot.sourceFrameSizeP95Bytes,
      keyFrameSizeBytes: snapshot.lastKeyFrameBytes,
      sourceInterFrameP95Ms: snapshot.sourceInterFrameP95Ms,
      droppedFrames: snapshot.video.droppedFrames,
      queueDepthMs: snapshot.video.queueDepthMs,
      relayP95Ms: snapshot.scrcpyReadToSinkWriteP95Ms,
      relayP99Ms: snapshot.scrcpyReadToSinkWriteP99Ms,
      eventLoopUtilization: snapshot.eventLoopUtilization,
      gcPauseP95Ms: snapshot.gcPauseP95Ms,
    };
  };
}
