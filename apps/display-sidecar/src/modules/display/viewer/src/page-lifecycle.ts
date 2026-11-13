import type { PageLifecycle } from "./types.js";

export function createPageLifecycle(suspendWhenHidden: boolean): PageLifecycle {
  const cleanupCallbacks = new Set<() => void>();
  const demandCallbacks = new Set<(active: boolean) => void>();
  let closing = false;
  let inPageCache = false;
  let active = !suspendWhenHidden || document.visibilityState === "visible";

  const updateDemand = () => {
    const next =
      !closing &&
      !inPageCache &&
      (!suspendWhenHidden || document.visibilityState === "visible");
    if (next === active) return;
    active = next;
    for (const callback of demandCallbacks) callback(active);
  };

  if (suspendWhenHidden) {
    document.addEventListener("visibilitychange", updateDemand);
    window.addEventListener("pageshow", () => {
      inPageCache = false;
      updateDemand();
    });
  }

  window.addEventListener("pagehide", (event) => {
    if (closing) return;
    if (suspendWhenHidden && event.persisted) {
      inPageCache = true;
      updateDemand();
      return;
    }
    closing = true;
    for (const cleanup of cleanupCallbacks) {
      cleanup();
    }
    document.removeEventListener("visibilitychange", updateDemand);
    cleanupCallbacks.clear();
    demandCallbacks.clear();
  });

  return {
    isClosing: () => closing,
    onClose(callback) {
      cleanupCallbacks.add(callback);
      return () => cleanupCallbacks.delete(callback);
    },
    hasDemand: () => active && !closing,
    onDemandChange(callback) {
      demandCallbacks.add(callback);
      return () => demandCallbacks.delete(callback);
    },
  };
}
