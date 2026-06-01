const audioPacketMagic = [0x52, 0x41, 0x30, 0x31];
const audioPacketHeaderBytes = audioPacketMagic.length + 1 + 8;
const maxScheduledLatencySeconds = 0.25;

export type ViewerAudioPacket = {
  data: Uint8Array<ArrayBufferLike>;
  timestamp: number;
  config: boolean;
};

export type ViewerAudioPlayer = {
  appendPacket: (packet: ViewerAudioPacket) => Promise<void>;
  reset: () => void;
};

export function parseViewerAudioPacket(
  bytes: Uint8Array<ArrayBufferLike>,
): ViewerAudioPacket | null {
  if (
    bytes.byteLength < audioPacketHeaderBytes ||
    audioPacketMagic.some((value, index) => bytes[index] !== value)
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    config: bytes[audioPacketMagic.length] === 1,
    timestamp: Number(view.getBigInt64(audioPacketMagic.length + 1)),
    data: bytes.subarray(audioPacketHeaderBytes),
  };
}

export function createViewerAudioPlayer(): ViewerAudioPlayer {
  let decoder: AudioDecoder | null = null;
  let context: AudioContext | null = null;
  let configured = false;
  let scheduledAt = 0;
  let description: Uint8Array<ArrayBufferLike> | undefined;

  function audioContext() {
    context ??= new AudioContext({ latencyHint: "interactive" });
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
    return context;
  }

  function schedule(frame: AudioData) {
    const activeContext = audioContext();
    const buffer = activeContext.createBuffer(
      frame.numberOfChannels,
      frame.numberOfFrames,
      frame.sampleRate,
    );
    for (let channel = 0; channel < frame.numberOfChannels; channel += 1) {
      frame.copyTo(buffer.getChannelData(channel), {
        planeIndex: channel,
        format: "f32-planar",
      });
    }
    frame.close();

    const startAt = Math.max(activeContext.currentTime + 0.03, scheduledAt);
    scheduledAt =
      startAt - activeContext.currentTime > maxScheduledLatencySeconds
        ? activeContext.currentTime + 0.03
        : startAt;
    const source = activeContext.createBufferSource();
    source.buffer = buffer;
    source.connect(activeContext.destination);
    source.start(scheduledAt);
    scheduledAt += buffer.duration;
  }

  async function configure() {
    if (configured) {
      return;
    }
    if (!("AudioDecoder" in window) || !("EncodedAudioChunk" in window)) {
      throw new Error("This browser cannot play the live display audio.");
    }
    const config: AudioDecoderConfig = {
      codec: "opus",
      sampleRate: 48_000,
      numberOfChannels: 2,
      description,
    };
    const support = await AudioDecoder.isConfigSupported(config).catch(() => ({
      supported: false,
    }));
    if (!support.supported) {
      throw new Error("This browser cannot decode the live display audio.");
    }
    decoder = new AudioDecoder({
      output: schedule,
      error(error) {
        console.warn("Display audio decoder failed.", error);
        configured = false;
        decoder = null;
      },
    });
    decoder.configure(config);
    configured = true;
  }

  function reset() {
    try {
      decoder?.close();
    } catch {
      // Decoder may already be closed after an async WebCodecs error.
    }
    decoder = null;
    configured = false;
    scheduledAt = 0;
  }

  window.addEventListener(
    "pointerdown",
    () => {
      if (context?.state === "suspended") {
        void context.resume().catch(() => undefined);
      }
    },
    { passive: true },
  );

  return {
    async appendPacket(packet) {
      if (packet.config) {
        description = packet.data;
        reset();
        return;
      }
      await configure();
      decoder?.decode(
        new EncodedAudioChunk({
          type: "key",
          timestamp: packet.timestamp,
          data: packet.data,
        }),
      );
    },
    reset,
  };
}
