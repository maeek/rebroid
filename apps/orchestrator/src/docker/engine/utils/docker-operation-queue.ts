export class DockerOperationQueue {
  private concurrency = 1;
  private active = 0;
  private activeBackground = 0;
  private readonly pending: Array<() => void> = [];
  private readonly pendingBackground: Array<() => void> = [];

  setConcurrency(concurrency: number) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new RangeError('Docker concurrency must be a positive integer.');
    }
    this.concurrency = concurrency;
    this.drain();
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.enqueue(operation);
  }

  runBackground<T>(operation: () => Promise<T>, signal: AbortSignal) {
    return this.enqueue(operation, signal);
  }

  private enqueue<T>(operation: () => Promise<T>, signal?: AbortSignal) {
    return new Promise<T>((resolve, reject) => {
      const pending = signal ? this.pendingBackground : this.pending;
      if (signal?.aborted) return reject(signal.reason);
      if (signal && pending.length >= 32) {
        return reject(new Error('The Docker stats queue is full.'));
      }
      const abort = () => {
        const index = pending.indexOf(start);
        if (index !== -1) pending.splice(index, 1);
        reject(signal?.reason);
      };
      const start = () => {
        signal?.removeEventListener('abort', abort);
        this.active += 1;
        if (signal) this.activeBackground += 1;
        void Promise.resolve()
          .then(operation)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            if (signal) this.activeBackground -= 1;
            this.drain();
          });
      };
      pending.push(start);
      signal?.addEventListener('abort', abort, { once: true });
      this.drain();
    });
  }

  private drain() {
    // Reserve one read slot for foreground work when more than one is available.
    const backgroundLimit = Math.min(4, Math.max(1, this.concurrency - 1));
    while (this.active < this.concurrency) {
      const next =
        this.pending.shift() ??
        (this.activeBackground < backgroundLimit
          ? this.pendingBackground.shift()
          : undefined);
      if (!next) return;
      next();
    }
  }
}
