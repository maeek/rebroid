import {
  rbd1Flag,
  rbd1HeaderBytes,
  rbd1Magic,
  rbd1MediaKind,
  rbd1Offset,
  rbd1Version,
} from "../display/viewer/src/rbd1-header.js";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import type { ScrcpyAudioPacket } from "./scrcpy.types";

export type RebroidMediaKind = keyof typeof rbd1MediaKind;

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
  const output = Buffer.allocUnsafe(rbd1HeaderBytes + frame.data.byteLength);
  output.writeUInt32BE(rbd1Magic, 0);
  output.writeUInt8(rbd1Version, rbd1Offset.version);
  output.writeUInt8(rbd1MediaKind[frame.kind], rbd1Offset.kind);
  let flags = 0;
  if (frame.config) {
    flags |= rbd1Flag.config;
  }
  if (frame.keyFrame) {
    flags |= rbd1Flag.keyFrame;
  }
  if (frame.discontinuity) {
    flags |= rbd1Flag.discontinuity;
  }
  output.writeUInt16BE(flags, rbd1Offset.flags);
  output.writeUInt32BE(frame.sequence >>> 0, rbd1Offset.sequence);
  output.writeBigUInt64BE(frame.timestampUs, rbd1Offset.timestampUs);
  output.writeUInt32BE(frame.data.byteLength, rbd1Offset.payloadLength);
  frame.data.copy(output, rbd1HeaderBytes);
  return output;
}
