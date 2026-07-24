import type { ScrcpyStreamOptions } from "./scrcpy.types";

export class ScrcpyStreamSessionRegistry {
  private readonly audioDisabledSessions = new Set<string>();

  beginStream(options: ScrcpyStreamOptions): ScrcpyStreamOptions {
    if (!options.audio) {
      this.audioDisabledSessions.delete(options.sessionId);
    }

    const audioDisabled =
      options.audio && this.audioDisabledSessions.has(options.sessionId);
    const effectiveOptions: ScrcpyStreamOptions = {
      ...options,
      audio: options.audio && !audioDisabled,
      control: options.control ?? true,
      compatibilityMode:
        options.compatibilityMode ??
        (audioDisabled ? "audio-disabled" : "normal"),
    };

    return effectiveOptions;
  }

  closeSession(sessionId: string): void {
    this.audioDisabledSessions.delete(sessionId);
  }

  markAudioDisabled(sessionId: string): void {
    this.audioDisabledSessions.add(sessionId);
  }

  isAudioDisabled(sessionId: string): boolean {
    return this.audioDisabledSessions.has(sessionId);
  }
}
