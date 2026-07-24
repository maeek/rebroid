import type { ScrcpyPacket } from "./scrcpy-packet-parser";

export interface ScrcpyH264Configuration {
  profileLevelId: string;
  sdpFmtpLine: string;
  width?: number;
  height?: number;
}

const h264MaximumMacroblocksPerSecond = new Map<number, number>([
  [10, 1_485],
  [11, 3_000],
  [12, 6_000],
  [13, 11_880],
  [20, 11_880],
  [21, 19_800],
  [22, 20_250],
  [30, 40_500],
  [31, 108_000],
  [32, 216_000],
  [40, 245_760],
  [41, 245_760],
  [42, 522_240],
  [50, 589_824],
  [51, 983_040],
  [52, 2_073_600],
  [60, 4_177_920],
  [61, 8_355_840],
  [62, 16_711_680],
]);

class BitReader {
  private bitOffset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  readBit(): number {
    if (this.bitOffset >= this.bytes.byteLength * 8) {
      throw new Error("Unexpected end of H.264 SPS");
    }
    const byte = this.bytes[this.bitOffset >>> 3]!;
    const bit = (byte >>> (7 - (this.bitOffset & 7))) & 1;
    this.bitOffset += 1;
    return bit;
  }

  readBits(count: number): number {
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      value = value * 2 + this.readBit();
    }
    return value;
  }

  readUnsignedExpGolomb(): number {
    let leadingZeroBits = 0;
    while (this.readBit() === 0) {
      leadingZeroBits += 1;
      if (leadingZeroBits > 31) {
        throw new Error("Invalid H.264 Exp-Golomb value");
      }
    }
    return 2 ** leadingZeroBits - 1 + this.readBits(leadingZeroBits);
  }

  readSignedExpGolomb(): number {
    const code = this.readUnsignedExpGolomb();
    const value = Math.ceil(code / 2);
    return code % 2 === 0 ? -value : value;
  }
}

function annexBNals(bytes: Uint8Array): Uint8Array[] {
  const starts: Array<{ index: number; length: number }> = [];
  for (let index = 0; index + 3 < bytes.byteLength; index += 1) {
    if (bytes[index] !== 0 || bytes[index + 1] !== 0) {
      continue;
    }
    if (bytes[index + 2] === 1) {
      starts.push({ index, length: 3 });
      index += 2;
    } else if (bytes[index + 2] === 0 && bytes[index + 3] === 1) {
      starts.push({ index, length: 4 });
      index += 3;
    }
  }
  return starts.flatMap((start, index) => {
    const end = starts[index + 1]?.index ?? bytes.byteLength;
    const nal = bytes.subarray(start.index + start.length, end);
    return nal.byteLength > 0 ? [nal] : [];
  });
}

function rbsp(nal: Uint8Array): Uint8Array {
  const bytes: number[] = [];
  for (let index = 1; index < nal.byteLength; index += 1) {
    if (
      index + 1 < nal.byteLength &&
      nal[index] === 0 &&
      nal[index + 1] === 0 &&
      nal[index + 2] === 3
    ) {
      bytes.push(0, 0);
      index += 2;
      continue;
    }
    bytes.push(nal[index]!);
  }
  return Uint8Array.from(bytes);
}

function skipScalingList(reader: BitReader, size: number): void {
  let lastScale = 8;
  let nextScale = 8;
  for (let index = 0; index < size; index += 1) {
    if (nextScale !== 0) {
      nextScale = (lastScale + reader.readSignedExpGolomb() + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
}

function parseSpsDimensions(sps: Uint8Array): {
  width?: number;
  height?: number;
} {
  try {
    const bytes = rbsp(sps);
    const reader = new BitReader(bytes);
    const profileIdc = reader.readBits(8);
    reader.readBits(8);
    reader.readBits(8);
    reader.readUnsignedExpGolomb();

    let chromaFormatIdc = 1;
    let separateColourPlaneFlag = 0;
    if (
      [
        44, 83, 86, 100, 110, 118, 122, 128, 134, 135, 138, 139, 144, 244,
      ].includes(profileIdc)
    ) {
      chromaFormatIdc = reader.readUnsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        separateColourPlaneFlag = reader.readBit();
      }
      reader.readUnsignedExpGolomb();
      reader.readUnsignedExpGolomb();
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

    reader.readUnsignedExpGolomb();
    const pictureOrderCountType = reader.readUnsignedExpGolomb();
    if (pictureOrderCountType === 0) {
      reader.readUnsignedExpGolomb();
    } else if (pictureOrderCountType === 1) {
      reader.readBit();
      reader.readSignedExpGolomb();
      reader.readSignedExpGolomb();
      const cycle = reader.readUnsignedExpGolomb();
      for (let index = 0; index < cycle; index += 1) {
        reader.readSignedExpGolomb();
      }
    }
    reader.readUnsignedExpGolomb();
    reader.readBit();
    const widthInMacroblocks = reader.readUnsignedExpGolomb() + 1;
    const heightInMapUnits = reader.readUnsignedExpGolomb() + 1;
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
      cropLeft = reader.readUnsignedExpGolomb();
      cropRight = reader.readUnsignedExpGolomb();
      cropTop = reader.readUnsignedExpGolomb();
      cropBottom = reader.readUnsignedExpGolomb();
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

export function inspectScrcpyH264Configuration(
  packet: Pick<ScrcpyPacket, "data">,
): ScrcpyH264Configuration {
  const sps = annexBNals(packet.data).find((nal) => (nal[0]! & 0x1f) === 7);
  if (!sps || sps.byteLength < 4) {
    throw new Error("H.264 bootstrap configuration is missing SPS");
  }
  const profileLevelId = Buffer.from(sps.subarray(1, 4))
    .toString("hex")
    .toLowerCase();
  return {
    profileLevelId,
    sdpFmtpLine: `level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=${profileLevelId}`,
    ...parseSpsDimensions(sps),
  };
}

export function supportsH264PixelRate(
  profileLevelId: string,
  width: number,
  height: number,
  framesPerSecond: number,
): boolean {
  if (!/^[0-9a-f]{6}$/i.test(profileLevelId)) {
    return false;
  }
  const levelIdc = Number.parseInt(profileLevelId.slice(4), 16);
  const maximum = h264MaximumMacroblocksPerSecond.get(levelIdc);
  if (!maximum) {
    return false;
  }
  const macroblocksPerSecond =
    Math.ceil(width / 16) * Math.ceil(height / 16) * framesPerSecond;
  return macroblocksPerSecond <= maximum;
}
