export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(operation);
    this.tail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }
}
