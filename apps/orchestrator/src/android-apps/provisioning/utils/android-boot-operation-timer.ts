/** Measures queue residence separately from admitted Docker work, including cleanup. */
export class AndroidBootOperationTimer {
  private readonly queuedAt = performance.now();
  private dispatchedAt: number | undefined;
  private settledAt: number | undefined;
  private outcome: 'fulfilled' | 'rejected' | 'pending' = 'pending';

  constructor(private readonly bootStartedAt: number) {}

  async run<T>(
    operation: (onDispatched: () => void) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await operation(() => {
        this.dispatchedAt ??= performance.now();
      });
      this.outcome = 'fulfilled';
      return result;
    } catch (error) {
      this.outcome = 'rejected';
      throw error;
    } finally {
      this.settledAt = performance.now();
    }
  }

  snapshot() {
    const settledAt = this.settledAt ?? performance.now();
    return {
      outcome: this.outcome,
      dispatched: this.dispatchedAt !== undefined,
      queuedAfterMs: Math.round(this.queuedAt - this.bootStartedAt),
      dispatchedAfterMs:
        this.dispatchedAt === undefined
          ? null
          : Math.round(this.dispatchedAt - this.bootStartedAt),
      settledAfterMs: Math.round(settledAt - this.bootStartedAt),
      queueMs: Math.round((this.dispatchedAt ?? settledAt) - this.queuedAt),
      executionMs:
        this.dispatchedAt === undefined
          ? null
          : Math.round(settledAt - this.dispatchedAt),
      totalMs: Math.round(settledAt - this.queuedAt),
    };
  }
}
