export class OperationDeadlineExceededError extends Error {
  constructor() {
    super('Operation deadline exceeded.');
  }
}

export class OperationDeadline {
  private readonly expiresAt: number;

  constructor(readonly timeoutMs: number) {
    this.expiresAt = performance.now() + timeoutMs;
  }

  remainingMs() {
    return Math.max(0, Math.ceil(this.expiresAt - performance.now()));
  }

  throwIfExpired() {
    if (this.remainingMs() === 0) throw new OperationDeadlineExceededError();
  }
}
