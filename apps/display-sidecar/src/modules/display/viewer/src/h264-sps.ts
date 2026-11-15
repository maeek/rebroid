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
