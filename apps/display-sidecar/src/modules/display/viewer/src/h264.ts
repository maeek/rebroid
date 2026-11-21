import { splitAnnexBPacket } from "./bytes.js";
import { h264DimensionsFromSps } from "./h264-sps.js";

function h264CodecFromSps(spsBytes: Uint8Array<ArrayBufferLike>): string {
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
    const type = nal[0]! & 0x1f;
    if (type === 7) {
      sps = new Uint8Array(nal);
    } else if (type === 8) {
      pps = new Uint8Array(nal);
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
  const nals = splitAnnexBPacket(bytes);
  if (nals.length === 0)
    throw new Error("H.264 access unit is not Annex-B framed.");
  const output = new Uint8Array(
    nals.reduce((size, nal) => size + 4 + nal.byteLength, 0),
  );
  const view = new DataView(output.buffer);
  let offset = 0;
  for (const nal of nals) {
    view.setUint32(offset, nal.byteLength);
    output.set(nal, offset + 4);
    offset += 4 + nal.byteLength;
  }
  return output;
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
