import type { ControlChannel, PageLifecycle, TouchPoint } from "./types.js";
import type { ViewerPresentation } from "./viewer-presentation.js";

type VideoSize = { width: number; height: number };
type TouchInputOptions = {
  target: HTMLElement;
  getVideoSize: () => VideoSize;
  controlChannel: ControlChannel;
  lifecycle: PageLifecycle;
  presentation?: ViewerPresentation;
};

type Contact = { id: number; point: TouchPoint; moved: boolean };
type Pointer = { size: VideoSize; contacts: Contact[] };
type PointerPhase = "down" | "move" | "up" | "cancel";
let nextContact = 0;

function sameSize(a: VideoSize, b: VideoSize) {
  return a.width === b.width && a.height === b.height;
}

function targetPoint(
  target: HTMLElement,
  size: VideoSize,
  event: Pick<MouseEvent, "clientX" | "clientY">,
  captured = false,
): TouchPoint | null {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height || !size.width || !size.height) return null;
  // The canvas and video both use object-fit: contain.
  const scale = Math.min(rect.width / size.width, rect.height / size.height);
  const x =
    (event.clientX - rect.left - (rect.width - size.width * scale) / 2) / scale;
  const y =
    (event.clientY - rect.top - (rect.height - size.height * scale) / 2) /
    scale;
  if (!captured && (x < 0 || y < 0 || x >= size.width || y >= size.height))
    return null;
  return {
    x: Math.min(size.width - 1, Math.max(0, Math.round(x))),
    y: Math.min(size.height - 1, Math.max(0, Math.round(y))),
  };
}

function mirror(point: TouchPoint, size: VideoSize): TouchPoint {
  return { x: size.width - 1 - point.x, y: size.height - 1 - point.y };
}

export function setupTouchInput({
  target,
  getVideoSize,
  controlChannel,
  lifecycle,
  presentation,
}: TouchInputOptions): void {
  const pointers = new Map<number, Pointer>();
  let moveFrame = 0;
  const acceptsInput = () =>
    lifecycle.hasDemand() &&
    !presentation?.isCompact() &&
    !target.classList.contains("hidden");
  const clearScroll = setupWheelInput(
    target,
    getVideoSize,
    controlChannel,
    () => acceptsInput() && pointers.size === 0,
  );

  const send = (contact: Contact, size: VideoSize, eventType: PointerPhase) =>
    controlChannel.send(
      {
        type: "touch",
        action: "pointer",
        eventType,
        pointerId: contact.id,
        ...contact.point,
        videoWidth: size.width,
        videoHeight: size.height,
      },
      "touch",
    );

  const finishPointer = (id: number, phase: "up" | "cancel") => {
    const pointer = pointers.get(id);
    if (!pointer) return;
    pointers.delete(id);
    for (const contact of pointer.contacts)
      void send(contact, pointer.size, phase).catch(() => undefined);
    if (target.hasPointerCapture(id)) target.releasePointerCapture(id);
    if (!pointers.size && moveFrame) {
      window.cancelAnimationFrame(moveFrame);
      moveFrame = 0;
    }
  };

  const cancelInput = () => {
    clearScroll();
    for (const id of pointers.keys()) finishPointer(id, "cancel");
  };
  lifecycle.onDemandChange((active) => {
    if (!active) cancelInput();
  });
  const stopWatchingPresentation = presentation?.onChange((compact) => {
    if (compact) cancelInput();
  });
  window.addEventListener("blur", cancelInput);
  lifecycle.onClose(() => {
    cancelInput();
    stopWatchingPresentation?.();
    window.removeEventListener("blur", cancelInput);
  });
  target.addEventListener("contextmenu", (event) => event.preventDefault());

  target.addEventListener("pointerdown", (event) => {
    if (
      !acceptsInput() ||
      !controlChannel.canSendLiveInput() ||
      pointers.has(event.pointerId) ||
      event.button !== 0
    )
      return;
    const size = getVideoSize();
    const point = targetPoint(target, size, event);
    if (!point) return;
    if ([...pointers.values()].some((pointer) => !sameSize(pointer.size, size)))
      cancelInput();
    const mirrored = event.pointerType === "mouse" && event.ctrlKey;
    const points = mirrored ? [point, mirror(point, size)] : [point];
    const usedSlots = new Set(
      [...pointers.values()].flatMap(({ contacts }) =>
        contacts.map(({ id }) => id % 2),
      ),
    );
    const freeSlots = [0, 1].filter((slot) => !usedSlots.has(slot));
    if (points.length > freeSlots.length) return;
    const pointer: Pointer = {
      size,
      contacts: points.map((position, index) => ({
        // A slot can be reused while an old unordered move is still in flight.
        id: nextContact++ * 2 + freeSlots[index],
        point: position,
        moved: false,
      })),
    };
    event.preventDefault();
    target.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, pointer);
    for (const contact of pointer.contacts) {
      void send(contact, size, "down").catch(() => {
        if (pointers.get(event.pointerId) === pointer) cancelInput();
      });
    }
  });

  const updatePointer = (pointer: Pointer, event: PointerEvent) => {
    const point = targetPoint(target, pointer.size, event, true);
    if (!point) return;
    pointer.contacts.forEach((contact, index) => {
      const next = index === 0 ? point : mirror(point, pointer.size);
      if (next.x === contact.point.x && next.y === contact.point.y) return;
      contact.point = next;
      contact.moved = true;
    });
  };

  target.addEventListener("pointermove", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (!acceptsInput() || !sameSize(pointer.size, getVideoSize())) {
      cancelInput();
      return;
    }
    event.preventDefault();
    updatePointer(pointer, event);
    if (moveFrame) return;
    moveFrame = window.requestAnimationFrame(() => {
      moveFrame = 0;
      if (!acceptsInput() || !sameSize(pointer.size, getVideoSize())) {
        cancelInput();
        return;
      }
      for (const { contacts, size } of pointers.values()) {
        for (const contact of contacts) {
          if (!contact.moved) continue;
          contact.moved = false;
          void send(contact, size, "move").catch(() => undefined);
        }
      }
    });
  });

  target.addEventListener("pointerup", (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    event.preventDefault();
    if (!sameSize(pointer.size, getVideoSize())) {
      cancelInput();
      return;
    }
    updatePointer(pointer, event);
    finishPointer(event.pointerId, "up");
  });

  const onPointerLost = (event: PointerEvent) => {
    if (pointers.has(event.pointerId)) cancelInput();
  };
  target.addEventListener("pointercancel", onPointerLost);
  target.addEventListener("lostpointercapture", onPointerLost);
}

function setupWheelInput(
  target: HTMLElement,
  getVideoSize: () => VideoSize,
  controlChannel: ControlChannel,
  acceptsInput: () => boolean,
) {
  let frame = 0;
  let pending:
    | (TouchPoint & VideoSize & { horizontal: number; vertical: number })
    | undefined;
  const clear = () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    pending = undefined;
  };

  target.addEventListener(
    "wheel",
    (event) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.defaultPrevented ||
        !acceptsInput() ||
        !controlChannel.canSendLiveInput()
      )
        return;
      const size = getVideoSize();
      const point = targetPoint(target, size, event);
      const mode = event.deltaMode;
      const { deltaX, deltaY } = event;
      if (!point || (!deltaX && !deltaY)) return;
      event.preventDefault();
      // A wheel notch commonly scrolls three lines. Preserve fractional trackpad deltas.
      const scale = mode === 1 ? 1 / 3 : mode === 2 ? 8 : 1 / 48;
      const previous = pending && sameSize(pending, size) ? pending : undefined;
      pending = {
        ...size,
        ...point,
        horizontal: (previous?.horizontal ?? 0) - deltaX * scale,
        vertical: (previous?.vertical ?? 0) - deltaY * scale,
      };
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const scroll = pending;
        frame = 0;
        pending = undefined;
        if (!scroll || !acceptsInput() || !sameSize(scroll, getVideoSize()))
          return;
        const horizontal = Math.max(-16, Math.min(16, scroll.horizontal));
        const vertical = Math.max(-16, Math.min(16, scroll.vertical));
        if (horizontal || vertical)
          controlChannel.sendScroll({
            x: scroll.x,
            y: scroll.y,
            videoWidth: scroll.width,
            videoHeight: scroll.height,
            horizontal,
            vertical,
          });
      });
    },
    { passive: false },
  );
  return clear;
}
