import { concatBytes, findStartCodes } from "./bytes.js";
import { h264DimensionsFromSps } from "./h264-sps.js";

export function h264CodecFromSps(
  spsBytes: Uint8Array<ArrayBufferLike>,
): string {
  if (spsBytes.byteLength < 4) {
    return "avc1.42E01F";
  }
  return (
    "avc1." +
    [spsBytes[1], spsBytes[2], spsBytes[3]]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function h264NalType(nal: Uint8Array<ArrayBufferLike>): number {
  return nal[0] & 0x1f;
}

export function splitAnnexBPacket(
  bytes: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBufferLike>[] {
  const starts = findStartCodes(bytes);
  if (!starts.length) {
    return [];
  }
  const nals: Uint8Array<ArrayBufferLike>[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index]!;
    const next = starts[index + 1];
    const start = current.index + current.length;
    const end = next ? next.index : bytes.byteLength;
    const nal = bytes.slice(start, end);
    if (nal.byteLength > 0) {
      nals.push(nal);
    }
  }
  return nals;
}

export function codecConfiguration(bytes: Uint8Array<ArrayBufferLike>): {
  codec: string;
  profileLevelId: string;
  sps: Uint8Array<ArrayBufferLike> | null;
  pps: Uint8Array<ArrayBufferLike> | null;
  width?: number;
  height?: number;
} {
  let sps: Uint8Array<ArrayBufferLike> | null = null;
  let pps: Uint8Array<ArrayBufferLike> | null = null;
  for (const nal of splitAnnexBPacket(bytes)) {
    const type = h264NalType(nal);
    if (type === 7) {
      sps = nal;
    } else if (type === 8) {
      pps = nal;
    }
  }
  const codec = sps ? h264CodecFromSps(sps) : "avc1.42E01F";
  return {
    codec,
    profileLevelId: codec.slice(5).toLowerCase(),
    sps,
    pps,
    ...(sps ? h264DimensionsFromSps(sps) : {}),
  };
}

export function annexBToAvcSample(
  bytes: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array<ArrayBufferLike>[] = [];
  for (const nal of splitAnnexBPacket(bytes)) {
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, nal.byteLength);
    parts.push(length, nal);
  }
  if (parts.length === 0) {
    throw new Error("H.264 access unit is not Annex-B framed.");
  }
  return concatBytes(parts);
}

export function avcDecoderConfigurationRecord(
  sps: Uint8Array<ArrayBufferLike>,
  pps: Uint8Array<ArrayBufferLike>,
): Uint8Array<ArrayBuffer> {
  if (
    sps.byteLength < 4 ||
    sps.byteLength > 0xffff ||
    pps.byteLength > 0xffff
  ) {
    throw new Error("Invalid H.264 decoder configuration.");
  }
  const output = new Uint8Array(11 + sps.byteLength + pps.byteLength);
  const view = new DataView(output.buffer);
  output.set([1, sps[1]!, sps[2]!, sps[3]!, 0xff, 0xe1], 0);
  view.setUint16(6, sps.byteLength);
  output.set(sps, 8);
  const ppsOffset = 8 + sps.byteLength;
  output[ppsOffset] = 1;
  view.setUint16(ppsOffset + 1, pps.byteLength);
  output.set(pps, ppsOffset + 3);
  return output;
}
