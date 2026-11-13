import { createConnection } from "node:net";
import { StringDecoder } from "node:string_decoder";
import type { Writable } from "node:stream";

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
  stunUrls: string[];
  maxFps: number;
  audio: boolean;
  h264FmtpLine: string;
  h264ProfileLevelId: string;
};

export interface WebrtcBridge {
  isOpen(): boolean;
  onClose(listener: () => void): void;
  listen(options: {
    signal: AbortSignal;
    onMessage: (message: WebrtcBridgeMessage) => void;
    onLog: (message: string) => void;
    onFailure: (error: Error) => void;
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

export const connectWebrtcBridge = (
  path: string,
  attemptId: string,
): WebrtcBridge => {
  // The server-generated attempt UUID also identifies its three private IPC sockets.
  const id = Buffer.from(attemptId.replaceAll("-", ""), "hex");
  const openStream = (index: number) => {
    const stream = createConnection(path);
    stream.on("error", () => undefined);
    stream.write(Buffer.concat([id, Buffer.from([index])]));
    return stream;
  };
  const streams = [openStream(0), openStream(1), openStream(2)] as const;
  const [commands, video, audio] = streams;
  const send = (message: object) =>
    commands.write(`${JSON.stringify(message)}\n`);

  return {
    isOpen: () => !commands.destroyed,
    onClose: (listener) => {
      commands.once("close", () => listener());
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
      signal.addEventListener("abort", () => commands.off("data", onData), {
        once: true,
      });
      commands.on("data", onData);
      commands.on("error", onFailure);
      video.on("error", onFailure);
      audio.on("error", onAudioFailure);
    },
    sendOffer: send,
    sendDataChannel: (payload) => send({ type: "datachannel", payload }),
    writeVideo: (payload) => writeMedia(video, payload),
    writeAudio: (payload) => writeMedia(audio, payload),
    stopAudio: () => audio.destroy(),
    close: () => {
      for (const stream of streams) stream.destroy();
    },
  };
};
