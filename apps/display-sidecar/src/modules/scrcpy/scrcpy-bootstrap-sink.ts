import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type {
  ScrcpyAudioPacket,
  ScrcpyMediaSink,
  ScrcpyMediaSinkSnapshot,
} from "./scrcpy.types";

const emptySnapshot = (): ScrcpyMediaSinkSnapshot => ({
  sourceVideoFrames: 0,
  sourceVideoBytes: 0,
  video: {
    queuedFrames: 0,
    queuedBytes: 0,
    queueDepthMs: 0,
    droppedFrames: 0,
    awaitingKeyFrame: true,
  },
  audio: {
    queuedFrames: 0,
    queuedBytes: 0,
    queueDepthMs: 0,
    droppedFrames: 0,
    awaitingKeyFrame: false,
  },
});

export class ScrcpyBootstrapSink implements ScrcpyMediaSink {
  private readonly closeListeners = new Set<
    (code?: number, reason?: Buffer) => void
  >();
  private open = true;

  isOpen(): boolean {
    return this.open;
  }

  onClose(listener: (code?: number, reason?: Buffer) => void): void {
    this.closeListeners.add(listener);
  }

  sendStatus(_payload: unknown): void {}

  writeVideo(
    _packet: ScrcpyPacket,
    completion?: (error?: Error) => void,
  ): void {
    completion?.();
  }

  writeAudio(
    _packet: ScrcpyAudioPacket,
    completion?: (error?: Error) => void,
  ): void {
    completion?.();
  }

  snapshot(): ScrcpyMediaSinkSnapshot {
    return emptySnapshot();
  }

  close(code = 1000, reason = "bootstrap complete"): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    const reasonBuffer = Buffer.from(reason);
    for (const listener of this.closeListeners) {
      listener(code, reasonBuffer);
    }
    this.closeListeners.clear();
  }
}
