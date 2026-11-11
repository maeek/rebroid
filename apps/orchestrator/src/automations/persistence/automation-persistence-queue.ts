import { Injectable } from '@nestjs/common';

@Injectable()
export class AutomationPersistenceQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.tail.then(operation, operation);
    this.tail = pending.catch(() => undefined);
    return pending;
  }
}
