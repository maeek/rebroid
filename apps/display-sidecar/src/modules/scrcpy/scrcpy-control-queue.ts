import { ScrcpyControlDispatchError } from "./scrcpy-control-dispatch-error";

const MAX_PENDING = 128;
const DISPATCH_TIMEOUT_MS = 3_000;

interface PendingControl {
  payloads: Buffer[];
  expiresAt: number;
  take: () => void;
  resolve: (result: true | Promise<true>) => void;
  reject: (error: unknown) => void;
}

export class ScrcpyControlQueue {
  private readonly sessions = new Map<string, Set<PendingControl>>();

  enqueue(sessionId: string, payloads: Buffer[]): Promise<true> {
    const queue = this.sessions.get(sessionId) ?? new Set<PendingControl>();
    if (queue.size >= MAX_PENDING) {
      return Promise.reject(
        this.notDispatched("The live control queue is full."),
      );
    }
    this.sessions.set(sessionId, queue);
    return new Promise((resolve, reject) => {
      const entry: PendingControl = {
        payloads,
        expiresAt: Date.now() + DISPATCH_TIMEOUT_MS,
        take: () => {
          clearTimeout(timer);
          queue.delete(entry);
          if (queue.size === 0) this.sessions.delete(sessionId);
        },
        resolve,
        reject,
      };
      const timer = setTimeout(() => {
        entry.take();
        reject(this.notDispatched("Live control did not reconnect in time."));
      }, DISPATCH_TIMEOUT_MS);
      timer.unref();
      queue.add(entry);
    });
  }

  flush(
    sessionId: string,
    write: (payloads: Buffer[]) => Promise<true>,
  ): number {
    const queue = this.sessions.get(sessionId);
    if (!queue) return 0;
    let submitted = 0;
    for (const entry of queue) {
      entry.take();
      if (entry.expiresAt <= Date.now()) {
        entry.reject(
          this.notDispatched("Live control did not reconnect in time."),
        );
        continue;
      }
      try {
        entry.resolve(write(entry.payloads));
      } catch (error) {
        entry.reject(error);
        this.discard(sessionId);
        break;
      }
      submitted += 1;
    }
    return submitted;
  }

  discard(sessionId: string): void {
    for (const entry of this.sessions.get(sessionId) ?? []) {
      entry.take();
      entry.reject(
        this.notDispatched("Live control disconnected before dispatch."),
      );
    }
  }

  private notDispatched(message: string) {
    return new ScrcpyControlDispatchError("control_not_dispatched", message);
  }
}
