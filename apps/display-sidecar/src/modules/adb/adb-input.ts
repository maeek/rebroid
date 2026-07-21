import type {
  KeyboardControlPayload,
  TouchControlPayload,
} from "../shared/display-control.types";

const browserKeyEvents: Record<string, string> = {
  Enter: "KEYCODE_ENTER",
  Backspace: "KEYCODE_DEL",
  Delete: "KEYCODE_FORWARD_DEL",
  Escape: "KEYCODE_BACK",
  Tab: "KEYCODE_TAB",
  ArrowUp: "KEYCODE_DPAD_UP",
  ArrowDown: "KEYCODE_DPAD_DOWN",
  ArrowLeft: "KEYCODE_DPAD_LEFT",
  ArrowRight: "KEYCODE_DPAD_RIGHT",
  PageUp: "KEYCODE_PAGE_UP",
  PageDown: "KEYCODE_PAGE_DOWN",
  Home: "KEYCODE_MOVE_HOME",
  End: "KEYCODE_MOVE_END",
};

const finiteNumber = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export const escapeAdbInputText = (value: string) =>
  value.replace(/%/g, "%25").replace(/\s/g, "%s");

export const clampDuration = (
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
) => {
  const parsed = finiteNumber(value);
  return parsed > 0
    ? Math.min(Math.max(Math.round(parsed), minimum), maximum)
    : fallback;
};

export const keyboardCommand = (event: KeyboardControlPayload) => {
  if (
    event.eventType !== "keydown" ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return null;
  }
  const specialKey = event.key ? browserKeyEvents[event.key] : undefined;
  if (specialKey) return ["input", "keyevent", specialKey];
  if (event.key?.length === 1) {
    return ["input", "text", escapeAdbInputText(event.key)];
  }
  return null;
};

export const touchCommand = (
  event: TouchControlPayload,
  displaySize: { width: number; height: number } | null,
) => {
  if (event.action === "pointer") return null;
  const videoWidth = finiteNumber(event.videoWidth);
  const videoHeight = finiteNumber(event.videoHeight);
  const scaleX =
    displaySize && videoWidth > 0 ? displaySize.width / videoWidth : 1;
  const scaleY =
    displaySize && videoHeight > 0 ? displaySize.height / videoHeight : 1;
  const point = (x?: number, y?: number) => ({
    x: Math.max(0, Math.round(finiteNumber(x) * scaleX)),
    y: Math.max(0, Math.round(finiteNumber(y) * scaleY)),
  });

  if (event.action === "swipe") {
    const from = point(event.x1, event.y1);
    const to = point(event.x2, event.y2);
    return [
      "input",
      "swipe",
      String(from.x),
      String(from.y),
      String(to.x),
      String(to.y),
      String(clampDuration(event.durationMs, 50, 2_000, 120)),
    ];
  }
  const target = point(event.x ?? event.x1, event.y ?? event.y1);
  return ["input", "tap", String(target.x), String(target.y)];
};
