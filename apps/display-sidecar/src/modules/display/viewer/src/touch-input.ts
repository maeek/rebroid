import type {
  ControlChannel,
  PageLifecycle,
  TouchInputPayload,
  TouchPayload,
  TouchPoint,
} from "./types.js";
import type { ViewerPresentation } from "./viewer-presentation.js";

type TouchInputOptions = {
  target: HTMLElement;
  getVideoSize: () => { width: number; height: number };
  controlChannel: ControlChannel;
  lifecycle: PageLifecycle;
  presentation?: ViewerPresentation;
};

type PointerStart = {
  id: number;
  point: TouchPoint;
  lastPoint: TouchPoint;
};

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
  lifecycle,
  presentation,
}: TouchInputOptions): void {
  let pointerStart: PointerStart | null = null;
  let pendingMove: TouchPoint | null = null;
  let moveFrame = 0;

  const clearPointer = () => {
    const pointer = pointerStart;
    pointerStart = null;
    pendingMove = null;
    if (moveFrame) window.cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    if (pointer && target.hasPointerCapture(pointer.id)) {
      target.releasePointerCapture(pointer.id);
    }
    return pointer;
  };

  lifecycle.onDemandChange((active) => {
    if (!active) clearPointer();
  });

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

  const cancelPointer = () => {
    const pointer = clearPointer();
    if (pointer) {
      postTouch({
        action: "pointer",
        eventType: "cancel",
        ...pointer.lastPoint,
      }).catch(() => undefined);
    }
  };

  const stopWatchingPresentation = presentation?.onChange((compact) => {
    if (compact) cancelPointer();
  });
  if (stopWatchingPresentation) lifecycle.onClose(stopWatchingPresentation);

  target.addEventListener("pointerdown", (event) => {
    if (
      pointerStart ||
      !lifecycle.hasDemand() ||
      presentation?.isCompact() ||
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
    const distance = Math.hypot(
      point.x - pointerStart.lastPoint.x,
      point.y - pointerStart.lastPoint.y,
    );
    if (distance < moveMinDistance) {
      return;
    }

    pointerStart.lastPoint = point;
    pendingMove = point;
    if (!moveFrame) {
      moveFrame = window.requestAnimationFrame(() => {
        moveFrame = 0;
        const latest = pendingMove;
        pendingMove = null;
        if (latest) {
          postTouch({
            action: "pointer",
            eventType: "move",
            x: latest.x,
            y: latest.y,
          }).catch(() => undefined);
        }
      });
    }
  });

  target.addEventListener("pointerup", (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) {
      return;
    }

    const point =
      targetPoint(target, getVideoSize(), event) ?? pointerStart.lastPoint;
    pointerStart = null;
    pendingMove = null;

    event.preventDefault();
    postTouch({
      action: "pointer",
      eventType: "up",
      x: point.x,
      y: point.y,
    }).catch(() => undefined);
  });

  target.addEventListener("pointercancel", (event) => {
    if (pointerStart?.id === event.pointerId) cancelPointer();
  });
  target.addEventListener("lostpointercapture", (event) => {
    if (pointerStart?.id === event.pointerId) cancelPointer();
  });
}
