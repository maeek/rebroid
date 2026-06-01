import type {
  ControlChannel,
  TouchInputPayload,
  TouchPayload,
  TouchPoint,
} from "./types";

type TouchInputOptions = {
  target: HTMLElement;
  getVideoSize: () => { width: number; height: number };
  controlChannel: ControlChannel;
};

type PointerStart = {
  id: number;
  point: TouchPoint;
  lastSentAt: number;
  lastPoint: TouchPoint;
};

const moveThrottleMs = 16;
const moveMinDistance = 1;

function targetPoint(
  target: HTMLElement,
  size: { width: number; height: number },
  event: PointerEvent,
): TouchPoint | null {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height || !size.width || !size.height) {
    return null;
  }

  return {
    x: Math.round(((event.clientX - rect.left) / rect.width) * size.width),
    y: Math.round(((event.clientY - rect.top) / rect.height) * size.height),
  };
}

export function setupTouchInput({
  target,
  getVideoSize,
  controlChannel,
}: TouchInputOptions): void {
  let pointerStart: PointerStart | null = null;

  target.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  const postTouch = (payload: TouchInputPayload) => {
    const size = getVideoSize();
    const touchPayload: TouchPayload = {
      ...payload,
      videoWidth: size.width,
      videoHeight: size.height,
    } as TouchPayload;
    return controlChannel.send(
      { type: "touch", ...touchPayload },
      "touch",
      touchPayload,
    );
  };

  target.addEventListener("pointerdown", (event) => {
    if (
      target.classList.contains("hidden") ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    const point = targetPoint(target, getVideoSize(), event);
    if (!point) {
      return;
    }

    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    pointerStart = {
      id: event.pointerId,
      point,
      lastPoint: point,
      lastSentAt: performance.now(),
    };
    postTouch({
      action: "pointer",
      eventType: "down",
      x: point.x,
      y: point.y,
    }).catch(() => undefined);
  });

  target.addEventListener("pointermove", (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) {
      return;
    }

    const point = targetPoint(target, getVideoSize(), event);
    if (!point) {
      return;
    }

    event.preventDefault();
    const now = performance.now();
    const distance = Math.hypot(
      point.x - pointerStart.lastPoint.x,
      point.y - pointerStart.lastPoint.y,
    );
    if (
      distance < moveMinDistance ||
      now - pointerStart.lastSentAt < moveThrottleMs
    ) {
      return;
    }

    pointerStart.lastPoint = point;
    pointerStart.lastSentAt = now;
    postTouch({
      action: "pointer",
      eventType: "move",
      x: point.x,
      y: point.y,
    }).catch(() => undefined);
  });

  target.addEventListener("pointerup", (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) {
      return;
    }

    const point =
      targetPoint(target, getVideoSize(), event) ?? pointerStart.lastPoint;
    pointerStart = null;

    event.preventDefault();
    postTouch({
      action: "pointer",
      eventType: "up",
      x: point.x,
      y: point.y,
    }).catch(() => undefined);
  });

  target.addEventListener("pointercancel", (event) => {
    if (pointerStart?.id === event.pointerId) {
      const point = pointerStart.lastPoint;
      pointerStart = null;
      postTouch({
        action: "pointer",
        eventType: "cancel",
        x: point.x,
        y: point.y,
      }).catch(() => undefined);
    }
  });
}
