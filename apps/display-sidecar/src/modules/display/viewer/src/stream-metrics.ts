import { emitViewerStreamMetrics } from "./stream-status";
import type { ViewerStreamMetrics } from "./types";

const metricsIntervalMs = 1_000;

export type StreamMetricsReporter = {
  addBytes: (bytes: number) => void;
  addFrame: () => void;
  start: () => void;
  stop: () => void;
};

export function createStreamMetricsReporter({
  getSize,
  transport,
}: {
  getSize: () => { width?: number; height?: number };
  transport: ViewerStreamMetrics["transport"];
}): StreamMetricsReporter {
  let bytes = 0;
  let frames = 0;
  let lastBytes = 0;
  let lastFrames = 0;
  let lastAt = performance.now();
  let timer = 0;

  const emit = () => {
    const now = performance.now();
    const elapsedSeconds = Math.max((now - lastAt) / 1000, 0.001);
    const byteDelta = bytes - lastBytes;
    const frameDelta = frames - lastFrames;
    const size = getSize();

    emitViewerStreamMetrics({
      transport,
      fps: frameDelta / elapsedSeconds,
      bitrateMbps: (byteDelta * 8) / elapsedSeconds / 1_000_000,
      width: size.width,
      height: size.height,
      collectedAt: Date.now(),
    });

    lastBytes = bytes;
    lastFrames = frames;
    lastAt = now;
  };

  return {
    addBytes(nextBytes) {
      bytes += Math.max(0, nextBytes);
    },
    addFrame() {
      frames += 1;
    },
    start() {
      if (timer) {
        return;
      }
      lastAt = performance.now();
      timer = window.setInterval(emit, metricsIntervalMs);
    },
    stop() {
      if (!timer) {
        return;
      }
      window.clearInterval(timer);
      timer = 0;
    },
  };
}
