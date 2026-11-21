import {
  FragmentedMp4Muxer,
  type FragmentedMp4Configuration,
  type FragmentedMp4Sample,
} from "./fragmented-mp4.js";

export type MseVideoFragmentMessage =
  | {
      type: "mse-init";
      epoch: number;
      codec: string;
      width: number;
      height: number;
      sourcePtsOriginUs: number;
      segment: ArrayBuffer;
    }
  | {
      type: "mse-segment";
      epoch: number;
      durationMs: number;
      sourcePtsOriginUs: number;
      samples: Array<{ sequence: number; timestampUs: number }>;
      segment: ArrayBuffer;
    };

export class MseVideoFragments {
  private readonly muxer = new FragmentedMp4Muxer();
  private readonly samples: FragmentedMp4Sample[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private initialized = false;
  private closed = false;

  constructor(
    private readonly epoch: number,
    private readonly configuration: FragmentedMp4Configuration,
    private readonly publish: (message: MseVideoFragmentMessage) => void,
  ) {}

  push(sample: FragmentedMp4Sample): void {
    if (this.closed) return;
    if (!this.initialized) {
      this.publish({
        type: "mse-init",
        epoch: this.epoch,
        sourcePtsOriginUs: sample.timestampUs,
        ...this.muxer.initialize(this.configuration),
      });
      this.initialized = true;
    }
    this.samples.push(sample);
    const followingSample = this.samples[2];
    if (followingSample) {
      this.flush(followingSample.timestampUs);
    } else {
      this.scheduleFlush();
    }
  }

  close(): void {
    this.closed = true;
    this.clearFlushTimer();
    this.samples.length = 0;
  }

  private flush(nextTimestampUs?: number): void {
    this.clearFlushTimer();
    if (this.closed || this.samples.length === 0) return;
    const fragment = this.muxer.fragment(
      this.samples.splice(0, 2),
      nextTimestampUs,
    );
    this.publish({ type: "mse-segment", epoch: this.epoch, ...fragment });
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined || this.samples.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, 33);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer === undefined) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
  }
}
