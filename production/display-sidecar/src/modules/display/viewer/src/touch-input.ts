import type {
  ControlChannel,
  TouchInputPayload,
  TouchPayload,
  TouchPoint,
} from "./types";

type TouchInputOptions = {
  canvas: HTMLCanvasElement;
  controlChannel: ControlChannel;
};

type PointerStart = {
  id: number;
  point: TouchPoint;
  startedAt: number;
};

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): TouchPoint | null {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || !canvas.width || !canvas.height) {
    return null;
  }

  return {
    x: Math.round(((event.clientX - rect.left) / rect.width) * canvas.width),
    y: Math.round(((event.clientY - rect.top) / rect.height) * canvas.height),
  };
}

export function setupTouchInput({ canvas, controlChannel }: TouchInputOptions): void {
  let pointerStart: PointerStart | null = null;

  const postTouch = (payload: TouchInputPayload) => {
    const touchPayload: TouchPayload = {
      ...payload,
      videoWidth: canvas.width,
      videoHeight: canvas.height,
    } as TouchPayload;
    return controlChannel.send(
      { type: "touch", ...touchPayload },
      "touch",
      touchPayload,
    );
  };

  canvas.addEventListener("pointerdown", event => {
    if (
      canvas.classList.contains("hidden") ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    const point = canvasPoint(canvas, event);
    if (!point) {
      return;
    }

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointerStart = {
      id: event.pointerId,
      point,
      startedAt: performance.now(),
    };
  });

  canvas.addEventListener("pointerup", event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) {
      return;
    }

    const point = canvasPoint(canvas, event);
    const start = pointerStart;
    pointerStart = null;
    if (!point) {
      return;
    }

    event.preventDefault();
    const durationMs = Math.max(50, Math.round(performance.now() - start.startedAt));
    const distance = Math.hypot(point.x - start.point.x, point.y - start.point.y);
    if (distance < 8 && durationMs < 500) {
      postTouch({ action: "tap", x: point.x, y: point.y }).catch(() => undefined);
      return;
    }

    postTouch({
      action: "swipe",
      x1: start.point.x,
      y1: start.point.y,
      x2: point.x,
      y2: point.y,
      durationMs,
    }).catch(() => undefined);
  });

  canvas.addEventListener("pointercancel", event => {
    if (pointerStart?.id === event.pointerId) {
      pointerStart = null;
    }
  });
}
