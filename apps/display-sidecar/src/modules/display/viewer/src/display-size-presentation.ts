export type DisplayFrameSize = { width: number; height: number };

export type DisplaySizePresentation = {
  previous: DisplayFrameSize;
  current: DisplayFrameSize;
  elapsedMs?: number;
};

const sameSize = (a: DisplayFrameSize, b: DisplayFrameSize) =>
  a.width === b.width && a.height === b.height;

export class DisplaySizePresentationTracker {
  private presentedSize?: DisplayFrameSize;
  private pending?: { at: number; size?: DisplayFrameSize };
  private lastChange?: DisplaySizePresentation;

  beginRecovery(at: number): void {
    if (this.presentedSize) {
      this.pending = { at };
    }
  }

  cancelPending(): void {
    this.pending = undefined;
  }

  expectSize(size: DisplayFrameSize, at: number): void {
    if (!this.presentedSize || sameSize(this.presentedSize, size)) {
      this.pending = undefined;
    } else if (!this.pending?.size || !sameSize(this.pending.size, size)) {
      this.pending = { at, size };
    }
  }

  present(size: DisplayFrameSize, at: number): boolean {
    if (
      !Number.isSafeInteger(size.width) ||
      !Number.isSafeInteger(size.height) ||
      size.width <= 0 ||
      size.height <= 0 ||
      !Number.isFinite(at)
    )
      return false;
    const previous = this.presentedSize;
    const pending = this.pending;
    if (
      pending &&
      (at < pending.at ||
        (pending.size && !sameSize(pending.size, size)) ||
        (!pending.size && previous && sameSize(previous, size)))
    ) {
      return false;
    }
    this.presentedSize = size;
    if (previous && !sameSize(previous, size)) {
      this.lastChange = {
        previous,
        current: size,
        elapsedMs: pending ? at - pending.at : undefined,
      };
    }
    this.pending = undefined;
    return true;
  }

  snapshot(): DisplaySizePresentation | undefined {
    return this.lastChange;
  }
}
