import { ServiceUnavailableException } from "@nestjs/common";

type PeerAdmission = {
  register: () => void;
  release: () => void;
  released: Promise<void>;
  retiring: boolean;
};

export class DisplayWebrtcPeerAdmission {
  private readonly peers = new Map<string, PeerAdmission>();

  constructor(
    private readonly send: (
      type: "register" | "retire",
      attemptId: string,
    ) => void,
  ) {}

  register(attemptId: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    let release!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let timer: NodeJS.Timeout | undefined;
    let onAbort!: () => void;
    return new Promise<void>((resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(
        () =>
          reject(
            new ServiceUnavailableException(
              "WebRTC bridge did not confirm peer admission.",
            ),
          ),
        5_000,
      );
      this.peers.set(attemptId, {
        register: resolve,
        release: () => {
          reject(
            new ServiceUnavailableException(
              "WebRTC bridge could not admit the peer.",
            ),
          );
          release();
        },
        released,
        retiring: false,
      });
      this.send("register", attemptId);
    }).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    });
  }

  retire(attemptId: string): Promise<void> | undefined {
    const peer = this.peers.get(attemptId);
    if (!peer) return;
    if (!peer.retiring) {
      peer.retiring = true;
      this.send("retire", attemptId);
    }
    return peer.released;
  }

  receive(line: string): void {
    let message: { type?: unknown; attemptId?: unknown } | null;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof message?.attemptId !== "string") return;
    const peer = this.peers.get(message.attemptId);
    if (message.type === "registered") {
      peer?.register();
    } else if (message.type === "released" || message.type === "rejected") {
      this.peers.delete(message.attemptId);
      peer?.release();
    }
  }

  close(): void {
    for (const peer of this.peers.values()) peer.release();
    this.peers.clear();
  }
}
