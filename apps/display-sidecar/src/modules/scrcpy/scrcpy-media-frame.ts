import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type { ScrcpyAudioPacket } from "./scrcpy.types";

export const REBROID_MEDIA_MAGIC = "RBD1";
export const REBROID_MEDIA_VERSION = 1;
export const REBROID_MEDIA_HEADER_BYTES = 24;

export const rebroidMediaKind = {
  video: 1,
  audio: 2,
} as const;

export const rebroidMediaFlag = {
  config: 1 << 0,
  keyFrame: 1 << 1,
  discontinuity: 1 << 2,
} as const;

export type RebroidMediaKind = keyof typeof rebroidMediaKind;

export interface RebroidMediaFrame {
  kind: RebroidMediaKind;
  sequence: number;
  timestampUs: bigint;
  config: boolean;
  keyFrame: boolean;
  discontinuity: boolean;
  data: Buffer;
}

export function videoMediaFrame(
  packet: ScrcpyPacket,
  sequence: number,
  discontinuity = false,
): RebroidMediaFrame {
  return {
    kind: "video",
    sequence,
    timestampUs: packet.timestampUs,
    config: packet.config,
    keyFrame: packet.keyFrame,
    discontinuity,
    data: packet.data,
  };
}

export function audioMediaFrame(
  packet: ScrcpyAudioPacket,
  sequence: number,
  discontinuity = false,
): RebroidMediaFrame {
  return {
    kind: "audio",
    sequence,
    timestampUs: packet.timestampUs,
    config: packet.config,
    keyFrame: true,
    discontinuity,
    data: packet.data,
  };
}

export function encodeRebroidMediaFrame(frame: RebroidMediaFrame): Buffer {
  const output = Buffer.allocUnsafe(
    REBROID_MEDIA_HEADER_BYTES + frame.data.byteLength,
  );
  output.write(REBROID_MEDIA_MAGIC, 0, 4, "ascii");
  output.writeUInt8(REBROID_MEDIA_VERSION, 4);
  output.writeUInt8(rebroidMediaKind[frame.kind], 5);
  let flags = 0;
  if (frame.config) {
    flags |= rebroidMediaFlag.config;
  }
  if (frame.keyFrame) {
    flags |= rebroidMediaFlag.keyFrame;
  }
  if (frame.discontinuity) {
    flags |= rebroidMediaFlag.discontinuity;
  }
  output.writeUInt16BE(flags, 6);
  output.writeUInt32BE(frame.sequence >>> 0, 8);
  output.writeBigUInt64BE(frame.timestampUs, 12);
  output.writeUInt32BE(frame.data.byteLength, 20);
  frame.data.copy(output, REBROID_MEDIA_HEADER_BYTES);
  return output;
}
