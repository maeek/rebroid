import { concatBytes, findStartCodes } from "./bytes.js";

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

export function annexBAccessUnit(
  nals: Uint8Array<ArrayBufferLike>[],
): Uint8Array<ArrayBufferLike> {
  return concatBytes(
    nals.map((nal) => concatBytes([new Uint8Array([0, 0, 0, 1]), nal])),
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

class SpsBitReader {
  private bitOffset = 0;

  constructor(private readonly bytes: Uint8Array<ArrayBufferLike>) {}

  readBit(): number {
    if (this.bitOffset >= this.bytes.byteLength * 8) {
      throw new Error("Unexpected end of H.264 SPS.");
    }
    const byte = this.bytes[this.bitOffset >>> 3]!;
    const value = (byte >>> (7 - (this.bitOffset & 7))) & 1;
    this.bitOffset += 1;
    return value;
  }

  readBits(count: number): number {
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      value = value * 2 + this.readBit();
    }
    return value;
  }

  unsignedExpGolomb(): number {
    let leadingZeroBits = 0;
    while (this.readBit() === 0) {
      leadingZeroBits += 1;
      if (leadingZeroBits > 31) {
        throw new Error("Invalid H.264 Exp-Golomb value.");
      }
    }
    return 2 ** leadingZeroBits - 1 + this.readBits(leadingZeroBits);
  }

  signedExpGolomb(): number {
    const code = this.unsignedExpGolomb();
    const value = Math.ceil(code / 2);
    return code % 2 === 0 ? -value : value;
  }
}

function spsRbsp(sps: Uint8Array<ArrayBufferLike>): Uint8Array<ArrayBuffer> {
  const output: number[] = [];
  for (let index = 1; index < sps.byteLength; index += 1) {
    if (
      index + 2 < sps.byteLength &&
      sps[index] === 0 &&
      sps[index + 1] === 0 &&
      sps[index + 2] === 3
    ) {
      output.push(0, 0);
      index += 2;
      continue;
    }
    output.push(sps[index]!);
  }
  return Uint8Array.from(output);
}

function skipScalingList(reader: SpsBitReader, size: number): void {
  let lastScale = 8;
  let nextScale = 8;
  for (let index = 0; index < size; index += 1) {
    if (nextScale !== 0) {
      nextScale = (lastScale + reader.signedExpGolomb() + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
}

export function h264DimensionsFromSps(sps: Uint8Array<ArrayBufferLike>): {
  width?: number;
  height?: number;
} {
  try {
    const reader = new SpsBitReader(spsRbsp(sps));
    const profileIdc = reader.readBits(8);
    reader.readBits(16);
    reader.unsignedExpGolomb();
    let chromaFormatIdc = 1;
    let separateColourPlaneFlag = 0;
    if (
      [
        44, 83, 86, 100, 110, 118, 122, 128, 134, 135, 138, 139, 144, 244,
      ].includes(profileIdc)
    ) {
      chromaFormatIdc = reader.unsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        separateColourPlaneFlag = reader.readBit();
      }
      reader.unsignedExpGolomb();
      reader.unsignedExpGolomb();
      reader.readBit();
      if (reader.readBit() === 1) {
        const count = chromaFormatIdc === 3 ? 12 : 8;
        for (let index = 0; index < count; index += 1) {
          if (reader.readBit() === 1) {
            skipScalingList(reader, index < 6 ? 16 : 64);
          }
        }
      }
    }
    reader.unsignedExpGolomb();
    const pictureOrderCountType = reader.unsignedExpGolomb();
    if (pictureOrderCountType === 0) {
      reader.unsignedExpGolomb();
    } else if (pictureOrderCountType === 1) {
      reader.readBit();
      reader.signedExpGolomb();
      reader.signedExpGolomb();
      const count = reader.unsignedExpGolomb();
      for (let index = 0; index < count; index += 1) {
        reader.signedExpGolomb();
      }
    }
    reader.unsignedExpGolomb();
    reader.readBit();
    const widthInMacroblocks = reader.unsignedExpGolomb() + 1;
    const heightInMapUnits = reader.unsignedExpGolomb() + 1;
    const frameMbsOnlyFlag = reader.readBit();
    if (frameMbsOnlyFlag === 0) {
      reader.readBit();
    }
    reader.readBit();
    let cropLeft = 0;
    let cropRight = 0;
    let cropTop = 0;
    let cropBottom = 0;
    if (reader.readBit() === 1) {
      cropLeft = reader.unsignedExpGolomb();
      cropRight = reader.unsignedExpGolomb();
      cropTop = reader.unsignedExpGolomb();
      cropBottom = reader.unsignedExpGolomb();
    }
    const chromaArrayType = separateColourPlaneFlag === 1 ? 0 : chromaFormatIdc;
    const subWidth = chromaArrayType === 1 || chromaArrayType === 2 ? 2 : 1;
    const subHeight = chromaArrayType === 1 ? 2 : 1;
    const cropUnitX = chromaArrayType === 0 ? 1 : subWidth;
    const cropUnitY =
      chromaArrayType === 0
        ? 2 - frameMbsOnlyFlag
        : subHeight * (2 - frameMbsOnlyFlag);
    return {
      width: widthInMacroblocks * 16 - (cropLeft + cropRight) * cropUnitX,
      height:
        (2 - frameMbsOnlyFlag) * heightInMapUnits * 16 -
        (cropTop + cropBottom) * cropUnitY,
    };
  } catch {
    return {};
  }
}
