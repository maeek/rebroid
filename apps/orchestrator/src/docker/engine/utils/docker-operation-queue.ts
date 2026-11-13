import type { DockerOperationOptions } from '../../contracts/docker-operation-options';
import { dockerOperationScope } from './docker-operation-scope';

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

  run<T>(
    operation: () => Promise<T>,
    options?: DockerOperationOptions,
  ): Promise<T> {
    return this.enqueue(operation, false, options);
  }

  runBackground<T>(operation: () => Promise<T>, signal: AbortSignal) {
    return this.enqueue(operation, true, { signal });
  }

  private enqueue<T>(
    operation: () => Promise<T>,
    background: boolean,
    options?: DockerOperationOptions,
  ) {
    return new Promise<T>((resolve, reject) => {
      const pending = background ? this.pendingBackground : this.pending;
      const scope = dockerOperationScope(options);
      const cleanup = () => {
        scope.signal.removeEventListener('abort', abort);
        scope.dispose();
      };
      const abort = () => {
        const index = pending.indexOf(start);
        if (index !== -1) pending.splice(index, 1);
        cleanup();
        reject(scope.signal.reason);
      };
      const start = () => {
        cleanup();
        this.active += 1;
        if (background) this.activeBackground += 1;
        void Promise.resolve()
          .then(() => {
            options?.signal?.throwIfAborted();
            options?.deadline?.throwIfExpired();
            return operation();
          })
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            if (background) this.activeBackground -= 1;
            this.drain();
          });
      };
      if (scope.signal.aborted) {
        abort();
        return;
      }
      if (background && pending.length >= 32) {
        cleanup();
        reject(new Error('The Docker stats queue is full.'));
        return;
      }
      pending.push(start);
      scope.signal.addEventListener('abort', abort, { once: true });
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
