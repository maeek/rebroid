export class DockerOperationQueue {
  private concurrency = 1;
  private active = 0;
  private readonly pending: Array<() => void> = [];

  setConcurrency(concurrency: number) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      throw new RangeError('Docker concurrency must be a positive integer.');
    }
    this.concurrency = concurrency;
    this.drain();
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push(() => {
        this.active += 1;
        void Promise.resolve()
          .then(operation)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.drain();
          });
      });
      this.drain();
    });
  }

  private drain() {
    while (this.active < this.concurrency && this.pending.length > 0) {
      this.pending.shift()!();
    }
  }
}
