declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor,
): void;

type PcmMessage = {
  type: "pcm";
  timestampUs: number;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  discontinuity: boolean;
  planes: ArrayBuffer[];
};

const targetFrames = Math.round(48_000 * 0.03);
const maximumFrames = Math.round(48_000 * 0.06);

class RebroidAudioProcessor extends AudioWorkletProcessor {
  private inputPort: MessagePort | null = null;
  private readonly left = new Float32Array(maximumFrames);
  private readonly right = new Float32Array(maximumFrames);
  private readOffset = 0;
  private writeOffset = 0;
  private queuedFrames = 0;
  private ptsOriginUs: number | null = null;
  private consumedFrames = 0;
  private started = false;
  private droppedFrames = 0;
  private reportedFrames = 0;

  constructor() {
    super();
    this.port.onmessage = (
      event: MessageEvent<{ type: string; port?: MessagePort }>,
    ) => {
      if (event.data.type === "connect" && event.data.port) {
        this.inputPort = event.data.port;
        this.inputPort.onmessage = (
          input: MessageEvent<PcmMessage | { type: "reset" }>,
        ) => {
          if (input.data.type === "reset") {
            this.reset();
            return;
          }
          this.append(input.data);
        };
        this.inputPort.start();
      }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    const leftOutput = output?.[0];
    const rightOutput = output?.[1] ?? leftOutput;
    if (!leftOutput || !rightOutput) {
      return true;
    }
    if (!this.started && this.queuedFrames >= targetFrames) {
      this.started = true;
    }
    if (!this.started || this.queuedFrames <= 0) {
      leftOutput.fill(0);
      rightOutput.fill(0);
      return true;
    }
    const count = Math.min(leftOutput.length, this.queuedFrames);
    this.readInto(leftOutput, rightOutput, count);
    if (count < leftOutput.length) {
      leftOutput.fill(0, count);
      rightOutput.fill(0, count);
      this.started = false;
    }
    this.consumedFrames += count;
    this.reportedFrames += count;
    if (this.reportedFrames >= Math.round(sampleRate / 10)) {
      this.reportedFrames = 0;
      this.inputPort?.postMessage({
        type: "playhead",
        timestampUs:
          (this.ptsOriginUs ?? 0) +
          (this.consumedFrames * 1_000_000) / sampleRate,
        queueDepthMs: (this.queuedFrames * 1_000) / sampleRate,
      });
    }
    return true;
  }

  private append(message: PcmMessage): void {
    if (message.discontinuity || this.ptsOriginUs === null) {
      this.reset();
      this.ptsOriginUs = message.timestampUs;
    }
    const left = new Float32Array(message.planes[0] ?? new ArrayBuffer(0));
    const right = new Float32Array(
      message.planes[1] ?? message.planes[0] ?? new ArrayBuffer(0),
    );
    const inputFrames = Math.min(
      message.numberOfFrames,
      left.length,
      right.length,
    );
    const overflow = Math.max(
      0,
      this.queuedFrames + inputFrames - maximumFrames,
    );
    let inputOffset = 0;
    if (overflow > 0) {
      const queuedDrop = Math.min(overflow, this.queuedFrames);
      this.readOffset = (this.readOffset + queuedDrop) % maximumFrames;
      this.queuedFrames -= queuedDrop;
      const inputDrop = overflow - queuedDrop;
      inputOffset = inputDrop;
      this.consumedFrames += overflow;
      this.droppedFrames += 1;
      this.inputPort?.postMessage({
        type: "audio-drops",
        droppedFrames: this.droppedFrames,
      });
    }
    for (let index = inputOffset; index < inputFrames; index += 1) {
      this.left[this.writeOffset] = left[index] ?? 0;
      this.right[this.writeOffset] = right[index] ?? left[index] ?? 0;
      this.writeOffset = (this.writeOffset + 1) % maximumFrames;
      this.queuedFrames += 1;
    }
  }

  private readInto(
    leftOutput: Float32Array,
    rightOutput: Float32Array,
    count: number,
  ): void {
    const firstCount = Math.min(count, maximumFrames - this.readOffset);
    leftOutput.set(
      this.left.subarray(this.readOffset, this.readOffset + firstCount),
    );
    rightOutput.set(
      this.right.subarray(this.readOffset, this.readOffset + firstCount),
    );
    const remaining = count - firstCount;
    if (remaining > 0) {
      leftOutput.set(this.left.subarray(0, remaining), firstCount);
      rightOutput.set(this.right.subarray(0, remaining), firstCount);
    }
    this.readOffset = (this.readOffset + count) % maximumFrames;
    this.queuedFrames -= count;
  }

  private reset(): void {
    this.readOffset = 0;
    this.writeOffset = 0;
    this.queuedFrames = 0;
    this.ptsOriginUs = null;
    this.consumedFrames = 0;
    this.started = false;
    this.reportedFrames = 0;
  }
}

registerProcessor("rebroid-audio", RebroidAudioProcessor);
