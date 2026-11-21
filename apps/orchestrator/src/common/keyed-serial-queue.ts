export class KeyedSerialQueue<Key> {
  private readonly pending = new Map<Key, Promise<unknown>>();

  async run<Result>(
    key: Key,
    operation: () => Promise<Result>,
  ): Promise<Result> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.pending.set(key, current);
    try {
      return await current;
    } finally {
      if (this.pending.get(key) === current) this.pending.delete(key);
    }
  }
}
