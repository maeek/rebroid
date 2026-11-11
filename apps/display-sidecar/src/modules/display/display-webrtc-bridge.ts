import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import type { Writable } from "node:stream";

const shutdownGraceMs = 1_000;

export type WebrtcBridgeMessage =
  | { type: "answer"; sdp: string }
  | { type: "control"; payload: unknown }
  | { type: "pointer-move"; payload: unknown }
  | { type: "state"; state: string }
  | { type: "log"; message: string }
  | { type: "metrics"; metrics: Record<string, number> }
  | { type: "video-resync-request"; message?: string }
  | { type: "audio-disabled"; message?: string }
  | { type: "error"; message: string };

export type WebrtcBridgeOffer = {
  type: "offer";
  sdp: string;
  iceHost: string;
  udpPortRange: string;
  stunUrls: string[];
  maxFps: number;
  audio: boolean;
  h264FmtpLine: string;
  h264ProfileLevelId: string;
};

export interface WebrtcBridge {
  isOpen(): boolean;
  onClose(listener: (code?: number, reason?: Buffer) => void): void;
  listen(options: {
    signal: AbortSignal;
    onMessage: (message: WebrtcBridgeMessage) => void;
    onLog: (message: string) => void;
    onFailure: (error: Error, source: "process" | "input") => void;
    onAudioFailure: () => void;
  }): void;
  sendOffer(offer: WebrtcBridgeOffer): void;
  sendDataChannel(payload: unknown): void;
  writeVideo(payload: Buffer): Promise<void>;
  writeAudio(payload: Buffer): Promise<void>;
  stopAudio(): void;
  close(): void;
}

const writeMedia = (input: Writable, payload: Buffer) =>
  new Promise<void>((resolve, reject) => {
    input.write(payload, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

export const spawnWebrtcBridge = (path: string): WebrtcBridge => {
  const bridge = spawn(path, [], {
    stdio: ["pipe", "pipe", "pipe", "pipe", "pipe"],
  });
  const video = bridge.stdio[3] as Writable;
  const audio = bridge.stdio[4] as Writable;
  const send = (message: object) =>
    bridge.stdin?.write(`${JSON.stringify(message)}\n`);

  return {
    isOpen: () => bridge.exitCode === null && !bridge.killed,
    onClose: (listener) => {
      bridge.once("close", (code, signal) =>
        listener(code ?? undefined, signal ? Buffer.from(signal) : undefined),
      );
    },
    listen: ({ signal, onMessage, onLog, onFailure, onAudioFailure }) => {
      const decoder = new StringDecoder("utf8");
      let buffer = "";
      const onData = (chunk: Buffer) => {
        buffer += decoder.write(chunk);
        let newline = buffer.indexOf("\n");
        while (newline >= 0 && !signal.aborted) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!line) continue;

          let message: WebrtcBridgeMessage;
          try {
            message = JSON.parse(line) as WebrtcBridgeMessage;
          } catch {
            onLog(line);
            continue;
          }
          if (message && typeof message.type === "string") onMessage(message);
        }
      };
      signal.addEventListener(
        "abort",
        () => bridge.stdout?.off("data", onData),
        { once: true },
      );
      bridge.stdout?.on("data", onData);
      bridge.stderr?.setEncoding("utf8");
      bridge.stderr?.on("data", (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) onLog(line);
        }
      });
      bridge.on("error", (error) => onFailure(error, "process"));
      bridge.stdin?.on("error", (error) => onFailure(error, "input"));
      video.on("error", (error) => onFailure(error, "input"));
      audio.on("error", onAudioFailure);
    },
    sendOffer: send,
    sendDataChannel: (payload) => send({ type: "datachannel", payload }),
    writeVideo: (payload) => writeMedia(video, payload),
    writeAudio: (payload) => writeMedia(audio, payload),
    stopAudio: () => audio.destroy(),
    close: () => {
      video.end();
      audio.end();
      if (bridge.exitCode !== null || bridge.signalCode !== null) return;
      if (!bridge.kill("SIGTERM")) return;
      const deadline = setTimeout(() => {
        if (bridge.exitCode === null && bridge.signalCode === null) {
          bridge.kill("SIGKILL");
        }
      }, shutdownGraceMs);
      deadline.unref();
      bridge.once("exit", () => clearTimeout(deadline));
    },
  };
};
