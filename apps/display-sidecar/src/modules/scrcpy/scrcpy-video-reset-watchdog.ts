const RECOVERY_TIMEOUT_MS = 3_000;

export class ScrcpyVideoResetWatchdog {
  private timer: NodeJS.Timeout | undefined;
  private sawConfiguration = false;

  get pending(): boolean {
    return this.timer !== undefined;
  }

  start(onTimeout: () => void): void {
    if (this.pending) return;
    const timer = setTimeout(() => {
      if (this.timer !== timer) return;
      this.clear();
      onTimeout();
    }, RECOVERY_TIMEOUT_MS);
    timer.unref();
    this.timer = timer;
  }

  observe({
    config,
    keyFrame,
  }: {
    config: boolean;
    keyFrame: boolean;
  }): boolean {
    if (!this.pending) return false;
    if (config) {
      this.sawConfiguration = true;
    } else if (keyFrame && this.sawConfiguration) {
      this.clear();
      return true;
    }
    return false;
  }

  clear(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.sawConfiguration = false;
  }
}
