import type { TouchControlPayload } from "../shared/display-control.types";
import { MAX_LIVE_POINTERS } from "./scrcpy-control-codec";
import { ScrcpyControlDispatchError } from "./scrcpy-control-dispatch-error";

interface Contact {
  event: TouchControlPayload;
  release: () => void;
}

export class ScrcpyLivePointers {
  private readonly contacts = new Map<number, Contact>();
  private owner?: AbortSignal;

  constructor(
    private readonly write: (
      event: TouchControlPayload,
      release: boolean,
    ) => Promise<boolean> | boolean,
    private readonly getVideoSize: () =>
      { width: number; height: number } | undefined,
  ) {}

  dispatch(event: TouchControlPayload, connection: AbortSignal) {
    if (connection.aborted || (this.owner && this.owner !== connection))
      return false;
    const id = event.pointerId ?? -1;
    const contact = this.contacts.get(id);
    if (event.eventType === "down") {
      if (contact || this.contacts.size >= MAX_LIVE_POINTERS) return false;
      return this.admit(id, event, connection);
    }
    if (!contact) return false;
    if (event.eventType === "move") {
      contact.event = event;
      return this.write(event, false);
    }
    if (event.eventType === "up" || event.eventType === "cancel") {
      return this.release(id, contact, connection, event);
    }
    return false;
  }

  clear() {
    if (!this.owner) return;
    for (const contact of this.contacts.values())
      this.owner.removeEventListener("abort", contact.release);
    this.contacts.clear();
    this.owner = undefined;
  }

  private async admit(
    id: number,
    event: TouchControlPayload,
    connection: AbortSignal,
  ) {
    const contact: Contact = {
      event,
      release: () => {
        void this.release(id, contact, connection).catch(() => undefined);
      },
    };
    this.owner = connection;
    this.contacts.set(id, contact);
    connection.addEventListener("abort", contact.release, { once: true });
    try {
      const dispatched = await this.write(event, false);
      if (!dispatched) this.forget(id, contact, connection);
      return dispatched;
    } catch (error) {
      if (
        error instanceof ScrcpyControlDispatchError &&
        error.code === "control_not_dispatched"
      ) {
        this.forget(id, contact, connection);
      }
      throw error;
    }
  }

  private async release(
    id: number,
    contact: Contact,
    connection: AbortSignal,
    event = contact.event,
  ) {
    this.forget(id, contact, connection);
    const size = this.getVideoSize();
    // scrcpy ignores coordinates from an old frame size, including releases.
    const release = {
      ...event,
      eventType: "up" as const,
      x: size ? Math.min(event.x ?? 0, size.width - 1) : event.x,
      y: size ? Math.min(event.y ?? 0, size.height - 1) : event.y,
      videoWidth: size?.width ?? event.videoWidth,
      videoHeight: size?.height ?? event.videoHeight,
    };
    return this.write(release, true);
  }

  private forget(id: number, contact: Contact, connection: AbortSignal) {
    if (this.contacts.get(id) !== contact) return;
    this.contacts.delete(id);
    connection.removeEventListener("abort", contact.release);
    if (!this.contacts.size) this.owner = undefined;
  }
}
