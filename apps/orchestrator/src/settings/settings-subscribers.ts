import { Logger } from '@nestjs/common';

export class SettingsSubscribers<T = void> {
  private readonly listeners = new Set<(value: T) => void>();
  constructor(private readonly context: string) {}

  subscribe(listener: (value: T) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(value: T) {
    for (const listener of this.listeners) {
      try {
        listener(value);
      } catch {
        Logger.warn(
          'A settings subscriber failed after persistence.',
          this.context,
        );
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}
