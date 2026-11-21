import { summarizeFrameGaps } from "./frame-gap-metrics.js";

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

export class DisplayMediaMetrics {
  private readonly totals = {
    bytes: 0,
    receivedFrames: 0,
    decodedFrames: 0,
    drawnFrames: 0,
  };
  private previousTotals = { ...this.totals };
  private lastSampleAt: number;
  private lastArrivalAt: number | null = null;
  private lastReceivedPtsUs: number | null = null;
  private latestSourcePtsUs = 0;
  private lastDrawAt: number | null = null;
  private sourceAdvancedSinceDraw = false;
  private freezeCount = 0;
  private readonly sourceGapsMs: number[] = [];
  private readonly networkJitterMs: number[] = [];
  private readonly decodeTimesMs: number[] = [];
  private readonly decodeToDrawMs: number[] = [];
  private readonly liveEdgeAgesMs: number[] = [];
  private readonly frameGapsMs: number[] = [];

  constructor(now: number) {
    this.lastSampleAt = now;
  }

  startSampling(now: number): void {
    this.lastSampleAt = now;
  }

  resetArrivalTiming(): void {
    this.lastArrivalAt = null;
    this.lastReceivedPtsUs = null;
    this.latestSourcePtsUs = 0;
  }

  recordWireBytes(bytes: number): void {
    this.totals.bytes += bytes;
  }

  recordVideoArrival(arrivalAt: number, timestampUs: number): void {
    this.totals.receivedFrames += 1;
    this.latestSourcePtsUs = Math.max(this.latestSourcePtsUs, timestampUs);
    this.sourceAdvancedSinceDraw = true;
    if (this.lastArrivalAt !== null && this.lastReceivedPtsUs !== null) {
      const sourceGapMs =
        Math.max(0, timestampUs - this.lastReceivedPtsUs) / 1_000;
      this.sourceGapsMs.push(sourceGapMs);
      this.networkJitterMs.push(
        Math.abs(arrivalAt - this.lastArrivalAt - sourceGapMs),
      );
    }
    this.lastArrivalAt = arrivalAt;
    this.lastReceivedPtsUs = timestampUs;
  }

  recordVideoDecode(decodedAt: number, startedAt: number | undefined): void {
    if (startedAt !== undefined) {
      this.decodeTimesMs.push(decodedAt - startedAt);
    }
    this.totals.decodedFrames += 1;
  }

  recordVideoDraw(
    drawnAt: number,
    decodedAt: number,
    timestampUs: number,
  ): void {
    this.decodeToDrawMs.push(drawnAt - decodedAt);
    this.liveEdgeAgesMs.push(
      Math.max(0, this.latestSourcePtsUs - timestampUs) / 1_000,
    );
    this.totals.drawnFrames += 1;
    if (this.sourceAdvancedSinceDraw && this.lastDrawAt !== null) {
      const gap = drawnAt - this.lastDrawAt;
      this.frameGapsMs.push(gap);
      if (gap > 100) {
        this.freezeCount += 1;
      }
    }
    this.sourceAdvancedSinceDraw = false;
    this.lastDrawAt = drawnAt;
  }

  sample(now: number) {
    const seconds = Math.max((now - this.lastSampleAt) / 1_000, 0.001);
    const drawnFps =
      (this.totals.drawnFrames - this.previousTotals.drawnFrames) / seconds;
    return {
      receivedFps:
        (this.totals.receivedFrames - this.previousTotals.receivedFrames) /
        seconds,
      decodedFps:
        (this.totals.decodedFrames - this.previousTotals.decodedFrames) /
        seconds,
      drawnFps,
      presentedFps: drawnFps,
      wireBitrateMbps:
        ((this.totals.bytes - this.previousTotals.bytes) * 8) /
        seconds /
        1_000_000,
      ...summarizeFrameGaps(this.frameGapsMs),
      sourceInterFrameP95Ms: percentile(this.sourceGapsMs, 0.95),
      networkInterArrivalJitterP95Ms: percentile(this.networkJitterMs, 0.95),
      decodeP95Ms: percentile(this.decodeTimesMs, 0.95),
      decodeToDrawP95Ms: percentile(this.decodeToDrawMs, 0.95),
      liveEdgeAgeP95Ms: percentile(this.liveEdgeAgesMs, 0.95),
      freezeCount: this.freezeCount,
    };
  }

  finishSample(now: number): void {
    this.previousTotals = { ...this.totals };
    this.lastSampleAt = now;
    this.sourceGapsMs.length = 0;
    this.networkJitterMs.length = 0;
    this.decodeTimesMs.length = 0;
    this.decodeToDrawMs.length = 0;
    this.liveEdgeAgesMs.length = 0;
    this.frameGapsMs.length = 0;
  }
}
