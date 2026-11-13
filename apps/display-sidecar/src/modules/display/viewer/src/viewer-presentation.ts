import type { PageLifecycle } from "./types.js";

const presentationMessageType = "rebroid-viewer-presentation";
const minimizeShortcutMessageType = "rebroid-viewer-minimize-shortcut";

export function createViewerPresentation(lifecycle: PageLifecycle) {
  let compact =
    window.frameElement?.hasAttribute("data-viewer-compact") === true;
  let minimizeShortcutEnabled = false;
  const listeners = new Set<(compact: boolean) => void>();

  const onMessage = (event: MessageEvent<unknown>) => {
    if (
      window.parent === window ||
      event.source !== window.parent ||
      event.origin !== window.location.origin ||
      typeof event.data !== "object" ||
      !event.data
    )
      return;

    const message = event.data as Record<string, unknown>;
    if (
      message.type !== presentationMessageType ||
      typeof message.compact !== "boolean" ||
      typeof message.minimizeShortcutEnabled !== "boolean"
    )
      return;

    minimizeShortcutEnabled = message.minimizeShortcutEnabled;
    if (compact === message.compact) return;
    compact = message.compact;
    for (const listener of listeners) listener(compact);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      !minimizeShortcutEnabled ||
      compact ||
      !lifecycle.hasDemand() ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.key.toLowerCase() !== "i"
    )
      return;

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest("input, textarea, select, [role=textbox]"))
    )
      return;

    event.preventDefault();
    window.parent.postMessage(
      { type: minimizeShortcutMessageType },
      window.location.origin,
    );
  };

  window.addEventListener("message", onMessage);
  window.addEventListener("keydown", onKeyDown);
  lifecycle.onClose(() => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener("keydown", onKeyDown);
    listeners.clear();
  });

  return {
    isCompact: () => compact,
    onChange(listener: (compact: boolean) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ViewerPresentation = ReturnType<typeof createViewerPresentation>;
