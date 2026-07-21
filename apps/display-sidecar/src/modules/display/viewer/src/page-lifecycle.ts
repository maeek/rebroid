import type { PageLifecycle } from "./types.js";

export function createPageLifecycle(): PageLifecycle {
  const cleanupCallbacks = new Set<() => void>();
  let closing = false;

  window.addEventListener("pagehide", () => {
    closing = true;
    for (const cleanup of cleanupCallbacks) {
      cleanup();
    }
  });

  return {
    isClosing: () => closing,
    onClose(callback) {
      cleanupCallbacks.add(callback);
      return () => cleanupCallbacks.delete(callback);
    },
  };
}
