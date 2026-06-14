import type {
  ScrcpyStreamClient,
  ScrcpyStreamOptions,
} from "./scrcpy.types";

export class ScrcpyStreamSessionRegistry {
  private readonly streamClients = new Map<string, ScrcpyStreamClient>();
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

    const previousClient = this.streamClients.get(options.sessionId);
    if (previousClient && previousClient !== options.client) {
      previousClient.close?.(1012, "Display stream replaced");
    }
    this.streamClients.set(options.sessionId, options.client);
    return effectiveOptions;
  }

  clearStreamClient(sessionId: string, client: ScrcpyStreamClient): void {
    if (this.streamClients.get(sessionId) === client) {
      this.streamClients.delete(sessionId);
    }
  }

  closeSession(sessionId: string): void {
    this.streamClients
      .get(sessionId)
      ?.close?.(1000, "Display session released");
    this.streamClients.delete(sessionId);
    this.audioDisabledSessions.delete(sessionId);
  }

  markAudioDisabled(sessionId: string): void {
    this.audioDisabledSessions.add(sessionId);
  }

  isAudioDisabled(sessionId: string): boolean {
    return this.audioDisabledSessions.has(sessionId);
  }
}
