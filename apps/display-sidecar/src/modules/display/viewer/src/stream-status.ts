import {
  viewerStreamMetricsMessageType,
  viewerStreamStatusMessageType,
} from "./config.js";
import type { ViewerStreamMetrics, ViewerStreamStatus } from "./types.js";

export type CompatibilityStatusInput = {
  mode?: unknown;
  message?: unknown;
  diagnostic?: unknown;
  transport?: ViewerStreamStatus["transport"];
  hasVisibleFrame: boolean;
};

export function statusFromCompatibility({
  mode,
  message,
  diagnostic,
  transport,
  hasVisibleFrame,
}: CompatibilityStatusInput): ViewerStreamStatus | null {
  if (mode === "normal" || typeof mode !== "string" || mode.length === 0) {
    return null;
  }

  const detail =
    typeof message === "string"
      ? message
      : typeof diagnostic === "string"
        ? diagnostic
        : null;

  if (mode === "audio-disabled") {
    return {
      code: "audio-disabled",
      severity: "info",
      blocking: false,
      message: detail ?? "Audio capture is disabled for this stream.",
      transport,
    };
  }

  if (mode === "stable-video") {
    return {
      code: "video-stalled",
      severity: "warning",
      blocking: !hasVisibleFrame,
      message: detail ?? "The stream switched to a conservative video mode.",
      transport,
    };
  }

  return {
    code: "stream-error",
    severity: hasVisibleFrame ? "warning" : "error",
    blocking: !hasVisibleFrame,
    message: detail ?? "The display stream changed compatibility mode.",
    transport,
  };
}

export function emitViewerStreamStatus(status: ViewerStreamStatus): void {
  window.parent.postMessage(
    {
      type: viewerStreamStatusMessageType,
      ...status,
    },
    window.location.origin,
  );
}

export function emitViewerStreamMetrics(metrics: ViewerStreamMetrics): void {
  window.parent.postMessage(
    {
      type: viewerStreamMetricsMessageType,
      ...metrics,
    },
    window.location.origin,
  );
}
