import type { ScrcpyPacket } from "./scrcpy-packet-parser";

const DEFAULT_FIRST_KEY_FRAME_TIMEOUT_MS = 8_000;

interface ScrcpyStreamLivenessOptions {
  onTimeout: (reason: string) => void;
  firstKeyFrameTimeoutMs?: number;
}

export class ScrcpyStreamLiveness {
  private firstKeyFrameTimer: NodeJS.Timeout | null = null;
  private firstKeyFrameSeen = false;
  private stopped = false;

  constructor(private readonly options: ScrcpyStreamLivenessOptions) {}

  start() {
    if (this.stopped || this.firstKeyFrameTimer) {
      return;
    }
    this.firstKeyFrameTimer = setTimeout(
      () => this.timeout("display stream first keyframe timed out"),
      this.options.firstKeyFrameTimeoutMs ?? DEFAULT_FIRST_KEY_FRAME_TIMEOUT_MS,
    );
  }

  stop() {
    this.stopped = true;
    this.clearFirstKeyFrameTimer();
  }

  recordVideoPacket(packet: Pick<ScrcpyPacket, "config" | "keyFrame">) {
    if (this.stopped || packet.config) {
      return;
    }

    if (packet.keyFrame) {
      this.firstKeyFrameSeen = true;
      this.clearFirstKeyFrameTimer();
    }
  }

  private timeout(reason: string) {
    if (this.stopped) {
      return;
    }
    this.stop();
    this.options.onTimeout(reason);
  }

  private clearFirstKeyFrameTimer() {
    if (this.firstKeyFrameTimer) {
      clearTimeout(this.firstKeyFrameTimer);
      this.firstKeyFrameTimer = null;
    }
  }
}
