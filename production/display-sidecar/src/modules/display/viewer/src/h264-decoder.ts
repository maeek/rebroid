import { concatBytes, findStartCodes } from "./bytes";
import type { DisplayDecoder, ViewerUi } from "./types";

const videoFrameDurationUs = 16_667;

type H264DecoderOptions = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  ui: ViewerUi;
};

function h264CodecFromSps(spsBytes: Uint8Array<ArrayBufferLike>): string {
  if (spsBytes.byteLength < 4) {
    return "avc1.42E01F";
  }

  return (
    "avc1." +
    [spsBytes[1], spsBytes[2], spsBytes[3]]
      .map(value => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function h264NalType(nal: Uint8Array<ArrayBufferLike>): number {
  return nal[0] & 0x1f;
}

function isH264Slice(type: number): boolean {
  return type === 1 || type === 5;
}

export function createH264Decoder({
  canvas,
  context,
  ui,
}: H264DecoderOptions): DisplayDecoder {
  let decoder: VideoDecoder | null = null;
  let configured = false;
  let codecName: string | null = null;
  let sps: Uint8Array<ArrayBufferLike> | null = null;
  let pps: Uint8Array<ArrayBufferLike> | null = null;
  let pendingNals: Uint8Array<ArrayBufferLike>[] = [];
  let streamBuffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  let timestamp = 0;
  let flushTimer = 0;
  let framesDecoded = 0;
  let needsKeyFrame = true;

  function closeDecoder() {
    if (!decoder) {
      return;
    }

    try {
      decoder.close();
    } catch {
      // Decoder may already be closed after an async WebCodecs error.
    }
    decoder = null;
  }

  function reset() {
    clearTimeout(flushTimer);
    pendingNals = [];
    streamBuffer = new Uint8Array(0);
    timestamp = 0;
    needsKeyFrame = true;
    configured = false;
    codecName = null;
    sps = null;
    pps = null;
    closeDecoder();
  }

  async function configureDecoder(nextCodec: string): Promise<void> {
    if (configured && codecName === nextCodec) {
      return;
    }

    closeDecoder();
    configured = false;
    needsKeyFrame = true;
    codecName = nextCodec;

    const config: VideoDecoderConfig = {
      codec: nextCodec,
      optimizeForLatency: true,
    };
    const support = await VideoDecoder.isConfigSupported(config).catch(() => ({
      supported: false,
    }));
    if (!support.supported) {
      console.warn("Display decoder config is not supported.", { codec: nextCodec });
      throw new Error("This browser cannot play the live display.");
    }

    decoder = new VideoDecoder({
      output(frame) {
        canvas.width = frame.displayWidth || frame.codedWidth;
        canvas.height = frame.displayHeight || frame.codedHeight;
        context.drawImage(frame, 0, 0, canvas.width, canvas.height);
        frame.close();
        framesDecoded += 1;
        ui.showCanvas();
      },
      error(error) {
        console.warn("Display decoder failed.", error);
        configured = false;
        decoder = null;
        needsKeyFrame = true;
        pendingNals = [];
        if (sps) {
          configureDecoder(h264CodecFromSps(sps)).catch(reconfigureError => {
            console.warn("Could not reconfigure display decoder.", reconfigureError);
          });
        }
        if (framesDecoded === 0) {
          ui.showStarting("Waiting for a clean frame...");
        }
      },
    });
    decoder.configure(config);
    configured = true;
  }

  async function flushAccessUnit(): Promise<void> {
    clearTimeout(flushTimer);
    if (!pendingNals.length) {
      return;
    }

    if (!decoder || !configured) {
      pendingNals = [];
      return;
    }

    const hasIdr = pendingNals.some(nal => h264NalType(nal) === 5);
    if (needsKeyFrame && !hasIdr) {
      pendingNals = [];
      return;
    }

    if (hasIdr && (!sps || !pps)) {
      pendingNals = [];
      needsKeyFrame = true;
      return;
    }

    const nals = hasIdr && sps && pps ? [sps, pps, ...pendingNals] : pendingNals;
    pendingNals = [];
    const chunkBytes = concatBytes(
      nals.map(nal => concatBytes([new Uint8Array([0, 0, 0, 1]), nal])),
    );
    const chunk = new EncodedVideoChunk({
      type: hasIdr ? "key" : "delta",
      timestamp,
      data: chunkBytes,
    });
    timestamp += videoFrameDurationUs;

    try {
      decoder.decode(chunk);
      if (hasIdr) {
        needsKeyFrame = false;
      }
    } catch (error) {
      console.warn("Could not decode display chunk.", error);
      needsKeyFrame = true;
    }
  }

  function scheduleFlush() {
    clearTimeout(flushTimer);
    flushTimer = window.setTimeout(() => {
      void flushAccessUnit();
    }, 12);
  }

  async function handleNal(nal: Uint8Array<ArrayBufferLike>): Promise<void> {
    const type = h264NalType(nal);
    if (type === 7) {
      if (pendingNals.length) {
        await flushAccessUnit();
      }
      sps = nal;
      await configureDecoder(h264CodecFromSps(nal));
      return;
    }

    if (type === 8) {
      if (pendingNals.length) {
        await flushAccessUnit();
      }
      pps = nal;
      return;
    }

    if (
      isH264Slice(type) &&
      pendingNals.some(existing => isH264Slice(h264NalType(existing)))
    ) {
      await flushAccessUnit();
    }

    pendingNals.push(nal);
    scheduleFlush();
  }

  async function appendStreamBytes(
    bytes: Uint8Array<ArrayBufferLike>,
  ): Promise<void> {
    streamBuffer = concatBytes([streamBuffer, bytes]);
    const starts = findStartCodes(streamBuffer);
    if (starts.length < 2) {
      return;
    }

    for (let i = 0; i < starts.length - 1; i += 1) {
      const current = starts[i];
      const next = starts[i + 1];
      const nal = streamBuffer.slice(current.index + current.length, next.index);
      if (nal.byteLength > 0) {
        await handleNal(nal);
      }
    }

    streamBuffer = streamBuffer.slice(starts[starts.length - 1].index);
  }

  return {
    appendStreamBytes,
    reset,
    hasFrames: () => framesDecoded > 0,
  };
}
