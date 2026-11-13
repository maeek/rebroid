const RECOVERY_TIMEOUT_MS = 3_000;

export class ScrcpyVideoResetWatchdog {
  private timer: NodeJS.Timeout | undefined;
  private dispatching = false;
  private sawConfiguration = false;
  private recoveredWhileDispatching = false;

  get pending(): boolean {
    return this.timer !== undefined;
  }

  beginDispatch(): void {
    if (!this.pending) this.dispatching = true;
  }

  confirmDispatch(onTimeout: () => void): boolean {
    if (!this.dispatching) return false;
    this.dispatching = false;
    if (this.recoveredWhileDispatching) {
      this.clear();
      return true;
    }
    const timer = setTimeout(() => {
      if (this.timer !== timer) return;
      this.clear();
      onTimeout();
    }, RECOVERY_TIMEOUT_MS);
    timer.unref();
    this.timer = timer;
    return false;
  }

  observe({
    config,
    keyFrame,
  }: {
    config: boolean;
    keyFrame: boolean;
  }): boolean {
    if (!this.dispatching && !this.pending) return false;
    if (config) {
      this.sawConfiguration = true;
    } else if (keyFrame && this.sawConfiguration) {
      if (this.dispatching) {
        this.recoveredWhileDispatching = true;
        return false;
      }
      this.clear();
      return true;
    }
    return false;
  }

  clear(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.dispatching = false;
    this.sawConfiguration = false;
    this.recoveredWhileDispatching = false;
  }
}
