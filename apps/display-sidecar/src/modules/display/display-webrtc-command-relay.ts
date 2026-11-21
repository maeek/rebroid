import type { Writable } from "node:stream";

const maxLineBytes = 1 << 20;
const maxReliableMessages = 64;

type Command = { line: string; bytes: number };
type ReplaceableCommand =
  "heartbeat" | "relay-metrics" | "webrtc-bridge-metrics";

export class WebrtcCommandQueueFullError extends Error {}

export function dataChannelReplaceKey(
  payload: unknown,
): ReplaceableCommand | undefined {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("type" in payload) ||
    "id" in payload
  )
    return;
  switch (payload.type) {
    case "heartbeat":
    case "relay-metrics":
    case "webrtc-bridge-metrics":
      return payload.type;
  }
}

export class WebrtcCommandRelay {
  private readonly reliable: Command[] = [];
  private readonly latest = new Map<ReplaceableCommand, Command>();
  private reliableBytes = 0;
  private blocked = false;

  constructor(private readonly socket: Writable) {
    socket.on("drain", () => this.drain());
    socket.once("close", () => {
      this.reliable.length = 0;
      this.reliableBytes = 0;
      this.latest.clear();
    });
  }

  send(message: object, replaceKey?: ReplaceableCommand): void {
    if (this.socket.destroyed) return;
    const line = `${JSON.stringify(message)}\n`;
    const bytes = Buffer.byteLength(line);
    if (bytes >= maxLineBytes) {
      this.socket.destroy(
        new Error("WebRTC bridge command exceeds the line limit."),
      );
      return;
    }
    if (!this.blocked) {
      this.blocked = !this.socket.write(line);
      return;
    }
    if (replaceKey) {
      this.latest.set(replaceKey, { line, bytes });
      return;
    }
    if (
      this.reliable.length >= maxReliableMessages ||
      this.reliableBytes + bytes > maxLineBytes
    ) {
      this.socket.destroy(
        new WebrtcCommandQueueFullError(
          "WebRTC bridge reliable command queue is full.",
        ),
      );
      return;
    }
    this.reliable.push({ line, bytes });
    this.reliableBytes += bytes;
  }

  private drain(): void {
    this.blocked = false;
    while (!this.blocked && !this.socket.destroyed) {
      const reliable = this.reliable.shift();
      if (reliable) {
        this.reliableBytes -= reliable.bytes;
        this.blocked = !this.socket.write(reliable.line);
        continue;
      }
      const replaceable = this.latest.entries().next();
      if (replaceable.done) return;
      const [key, command] = replaceable.value;
      this.latest.delete(key);
      this.blocked = !this.socket.write(command.line);
    }
  }
}
