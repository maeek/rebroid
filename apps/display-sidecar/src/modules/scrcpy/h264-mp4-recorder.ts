type H264Sample = {
  data: Buffer;
  timestampUs: bigint;
  duration: number;
  keyFrame: boolean;
};

type H264TrackConfig = {
  sps: Buffer;
  pps: Buffer;
  width: number;
  height: number;
};

const MP4_TIMESCALE = 90_000;
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;

const box = (type: string, ...parts: Buffer[]) => {
  const size = 8 + parts.reduce((total, part) => total + part.length, 0);
  const output = Buffer.alloc(size);
  output.writeUInt32BE(size, 0);
  output.write(type, 4, 4, "ascii");
  let offset = 8;
  for (const part of parts) {
    part.copy(output, offset);
    offset += part.length;
  }
  return output;
};

const fullBox = (
  type: string,
  version: number,
  flags: number,
  ...parts: Buffer[]
) => {
  const header = Buffer.alloc(4);
  header.writeUInt8(version, 0);
  header.writeUIntBE(flags, 1, 3);
  return box(type, header, ...parts);
};

const uint16 = (value: number) => {
  const output = Buffer.alloc(2);
  output.writeUInt16BE(value, 0);
  return output;
};

const uint32 = (value: number) => {
  const output = Buffer.alloc(4);
  output.writeUInt32BE(value >>> 0, 0);
  return output;
};

const fixed16 = (value: number) => uint32(Math.round(value * 65536));

const text = (value: string) => Buffer.from(value, "ascii");

const matrix = () =>
  Buffer.from([
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
  ]);

const removeEmulationPreventionBytes = (value: Buffer) => {
  const output: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (
      index >= 2 &&
      value[index] === 0x03 &&
      value[index - 1] === 0x00 &&
      value[index - 2] === 0x00
    ) {
      continue;
    }
    output.push(value[index]);
  }
  return Buffer.from(output);
};

class BitReader {
  private bitOffset = 0;

  constructor(private readonly data: Buffer) {}

  readBits(count: number) {
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      const byte = this.data[Math.floor(this.bitOffset / 8)] ?? 0;
      value = (value << 1) | ((byte >> (7 - (this.bitOffset % 8))) & 1);
      this.bitOffset += 1;
    }
    return value;
  }

  readBool() {
    return this.readBits(1) === 1;
  }

  readUnsignedExpGolomb() {
    let leadingZeroBits = 0;
    while (this.readBits(1) === 0 && leadingZeroBits < 32) {
      leadingZeroBits += 1;
    }
    return (1 << leadingZeroBits) - 1 + this.readBits(leadingZeroBits);
  }

  readSignedExpGolomb() {
    const value = this.readUnsignedExpGolomb();
    return value % 2 === 0 ? -(value / 2) : (value + 1) / 2;
  }
}

const skipScalingList = (reader: BitReader, size: number) => {
  let lastScale = 8;
  let nextScale = 8;
  for (let index = 0; index < size; index += 1) {
    if (nextScale !== 0) {
      nextScale = (lastScale + reader.readSignedExpGolomb() + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
};

const parseSpsDimensions = (sps: Buffer) => {
  try {
    const reader = new BitReader(
      removeEmulationPreventionBytes(sps.subarray(1)),
    );
    const profileIdc = reader.readBits(8);
    reader.readBits(8);
    reader.readBits(8);
    reader.readUnsignedExpGolomb();

    let chromaFormatIdc = 1;
    if (
      [100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134].includes(
        profileIdc,
      )
    ) {
      chromaFormatIdc = reader.readUnsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        reader.readBits(1);
      }
      reader.readUnsignedExpGolomb();
      reader.readUnsignedExpGolomb();
      reader.readBits(1);
      if (reader.readBool()) {
        const scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
        for (let index = 0; index < scalingListCount; index += 1) {
          if (reader.readBool()) {
            skipScalingList(reader, index < 6 ? 16 : 64);
          }
        }
      }
    }

    reader.readUnsignedExpGolomb();
    const picOrderCntType = reader.readUnsignedExpGolomb();
    if (picOrderCntType === 0) {
      reader.readUnsignedExpGolomb();
    } else if (picOrderCntType === 1) {
      reader.readBits(1);
      reader.readSignedExpGolomb();
      reader.readSignedExpGolomb();
      const cycleLength = reader.readUnsignedExpGolomb();
      for (let index = 0; index < cycleLength; index += 1) {
        reader.readSignedExpGolomb();
      }
    }

    reader.readUnsignedExpGolomb();
    reader.readBits(1);
    const picWidthInMbsMinus1 = reader.readUnsignedExpGolomb();
    const picHeightInMapUnitsMinus1 = reader.readUnsignedExpGolomb();
    const frameMbsOnlyFlag = reader.readBool();
    if (!frameMbsOnlyFlag) {
      reader.readBits(1);
    }
    reader.readBits(1);

    let frameCropLeftOffset = 0;
    let frameCropRightOffset = 0;
    let frameCropTopOffset = 0;
    let frameCropBottomOffset = 0;
    if (reader.readBool()) {
      frameCropLeftOffset = reader.readUnsignedExpGolomb();
      frameCropRightOffset = reader.readUnsignedExpGolomb();
      frameCropTopOffset = reader.readUnsignedExpGolomb();
      frameCropBottomOffset = reader.readUnsignedExpGolomb();
    }

    const chromaArrayType = chromaFormatIdc;
    const cropUnitX = chromaArrayType === 0 ? 1 : chromaArrayType === 3 ? 1 : 2;
    const cropUnitY =
      chromaArrayType === 0
        ? 2 - Number(frameMbsOnlyFlag)
        : (chromaArrayType === 1 ? 2 : 1) * (2 - Number(frameMbsOnlyFlag));
    const width =
      (picWidthInMbsMinus1 + 1) * 16 -
      (frameCropLeftOffset + frameCropRightOffset) * cropUnitX;
    const height =
      (picHeightInMapUnitsMinus1 + 1) * 16 * (2 - Number(frameMbsOnlyFlag)) -
      (frameCropTopOffset + frameCropBottomOffset) * cropUnitY;

    return {
      width: width > 0 ? width : DEFAULT_WIDTH,
      height: height > 0 ? height : DEFAULT_HEIGHT,
    };
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
};

const findStartCodes = (data: Buffer) => {
  const starts: Array<{ index: number; length: number }> = [];
  for (let index = 0; index < data.length - 3; index += 1) {
    if (data[index] === 0 && data[index + 1] === 0 && data[index + 2] === 1) {
      starts.push({ index, length: 3 });
      index += 2;
    } else if (
      index < data.length - 4 &&
      data[index] === 0 &&
      data[index + 1] === 0 &&
      data[index + 2] === 0 &&
      data[index + 3] === 1
    ) {
      starts.push({ index, length: 4 });
      index += 3;
    }
  }
  return starts;
};

const splitAnnexBNals = (data: Buffer) => {
  const starts = findStartCodes(data);
  if (!starts.length) {
    return data.length ? [data] : [];
  }

  return starts
    .map((start, index) => {
      const next = starts[index + 1]?.index ?? data.length;
      return data.subarray(start.index + start.length, next);
    })
    .filter((nal) => nal.length > 0);
};

const lengthPrefixedNals = (nals: Buffer[]) =>
  Buffer.concat(
    nals.map((nal) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(nal.length, 0);
      return Buffer.concat([length, nal]);
    }),
  );

const compactSttsEntries = (samples: H264Sample[]) => {
  const entries: Array<{ count: number; duration: number }> = [];
  for (const sample of samples) {
    const last = entries[entries.length - 1];
    if (last?.duration === sample.duration) {
      last.count += 1;
    } else {
      entries.push({ count: 1, duration: sample.duration });
    }
  }
  return entries;
};

export class H264Mp4Recorder {
  private readonly samples: H264Sample[] = [];
  private sps: Buffer | null = null;
  private pps: Buffer | null = null;
  private baseTimestampUs: bigint | null = null;
  private lastTimestampUs: bigint | null = null;

  constructor(private readonly defaultFrameDuration: number) {}

  addPacket(data: Buffer, timestampUs: bigint) {
    const nals = splitAnnexBNals(data);
    for (const nal of nals) {
      const type = nal[0] & 0x1f;
      if (type === 7) this.sps = Buffer.from(nal);
      if (type === 8) this.pps = Buffer.from(nal);
    }

    const hasVideoSlice = nals.some((nal) => {
      const type = nal[0] & 0x1f;
      return type === 1 || type === 5;
    });
    if (!hasVideoSlice) {
      return;
    }

    const normalizedTimestampUs = this.normalizeTimestamp(timestampUs);
    const previous = this.samples[this.samples.length - 1];
    if (previous) {
      const delta =
        normalizedTimestampUs - (this.lastTimestampUs ?? normalizedTimestampUs);
      previous.duration = this.durationFromDelta(delta);
    }
    this.lastTimestampUs = normalizedTimestampUs;

    this.samples.push({
      data: lengthPrefixedNals(nals.filter((nal) => (nal[0] & 0x1f) !== 9)),
      timestampUs: normalizedTimestampUs,
      duration: this.defaultFrameDuration,
      keyFrame: nals.some((nal) => (nal[0] & 0x1f) === 5),
    });
  }

  finish() {
    if (!this.samples.length || !this.sps || !this.pps) {
      throw new Error("Recording did not receive a complete H.264 key frame.");
    }

    const config = this.trackConfig();
    const mdatPayload = Buffer.concat(
      this.samples.map((sample) => sample.data),
    );
    const ftyp = this.ftyp();
    const provisionalMoov = this.moov(config, 0);
    const mdatOffset = ftyp.length + provisionalMoov.length + 8;
    const moov = this.moov(config, mdatOffset);
    const mdat = box("mdat", mdatPayload);

    return Buffer.concat([ftyp, moov, mdat]);
  }

  get sampleCount() {
    return this.samples.length;
  }

  get durationMs() {
    const ticks = this.samples.reduce(
      (total, sample) => total + sample.duration,
      0,
    );
    return Math.round((ticks / MP4_TIMESCALE) * 1000);
  }

  private normalizeTimestamp(timestampUs: bigint) {
    this.baseTimestampUs ??= timestampUs;
    return timestampUs - this.baseTimestampUs;
  }

  private durationFromDelta(deltaUs: bigint) {
    if (deltaUs <= 0n) {
      return this.defaultFrameDuration;
    }
    return Math.max(
      1,
      Math.round((Number(deltaUs) / 1_000_000) * MP4_TIMESCALE),
    );
  }

  private trackConfig(): H264TrackConfig {
    const sps = this.sps!;
    const pps = this.pps!;
    const dimensions = parseSpsDimensions(sps);
    return {
      sps,
      pps,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  private ftyp() {
    return box(
      "ftyp",
      text("isom"),
      uint32(0x200),
      text("isom"),
      text("iso2"),
      text("avc1"),
      text("mp41"),
    );
  }

  private moov(config: H264TrackConfig, mdatOffset: number) {
    return box("moov", this.mvhd(), this.trak(config, mdatOffset));
  }

  private mvhd() {
    const duration = this.samples.reduce(
      (total, sample) => total + sample.duration,
      0,
    );
    return fullBox(
      "mvhd",
      0,
      0,
      uint32(0),
      uint32(0),
      uint32(MP4_TIMESCALE),
      uint32(duration),
      fixed16(1),
      uint16(0x0100),
      Buffer.alloc(10),
      matrix(),
      Buffer.alloc(24),
      uint32(2),
    );
  }

  private trak(config: H264TrackConfig, mdatOffset: number) {
    return box("trak", this.tkhd(config), this.mdia(config, mdatOffset));
  }

  private tkhd(config: H264TrackConfig) {
    const duration = this.samples.reduce(
      (total, sample) => total + sample.duration,
      0,
    );
    return fullBox(
      "tkhd",
      0,
      0x000007,
      uint32(0),
      uint32(0),
      uint32(1),
      uint32(0),
      uint32(duration),
      Buffer.alloc(8),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      matrix(),
      fixed16(config.width),
      fixed16(config.height),
    );
  }

  private mdia(config: H264TrackConfig, mdatOffset: number) {
    return box("mdia", this.mdhd(), this.hdlr(), this.minf(config, mdatOffset));
  }

  private mdhd() {
    const duration = this.samples.reduce(
      (total, sample) => total + sample.duration,
      0,
    );
    return fullBox(
      "mdhd",
      0,
      0,
      uint32(0),
      uint32(0),
      uint32(MP4_TIMESCALE),
      uint32(duration),
      uint16(0x55c4),
      uint16(0),
    );
  }

  private hdlr() {
    return fullBox(
      "hdlr",
      0,
      0,
      uint32(0),
      text("vide"),
      Buffer.alloc(12),
      Buffer.from("VideoHandler\0", "ascii"),
    );
  }

  private minf(config: H264TrackConfig, mdatOffset: number) {
    return box(
      "minf",
      fullBox("vmhd", 0, 1, uint16(0), uint16(0), uint16(0), uint16(0)),
      this.dinf(),
      this.stbl(config, mdatOffset),
    );
  }

  private dinf() {
    return box("dinf", fullBox("dref", 0, 0, uint32(1), fullBox("url ", 0, 1)));
  }

  private stbl(config: H264TrackConfig, mdatOffset: number) {
    return box(
      "stbl",
      this.stsd(config),
      this.stts(),
      this.stss(),
      this.stsc(),
      this.stsz(),
      this.stco(mdatOffset),
    );
  }

  private stsd(config: H264TrackConfig) {
    return fullBox("stsd", 0, 0, uint32(1), this.avc1(config));
  }

  private avc1(config: H264TrackConfig) {
    const compressor = Buffer.alloc(32);
    Buffer.from("Rebroid H.264", "ascii").copy(compressor, 1);
    return box(
      "avc1",
      Buffer.alloc(6),
      uint16(1),
      Buffer.alloc(16),
      uint16(config.width),
      uint16(config.height),
      uint32(0x00480000),
      uint32(0x00480000),
      uint32(0),
      uint16(1),
      compressor,
      uint16(0x18),
      uint16(0xffff),
      this.avcC(config),
    );
  }

  private avcC({ sps, pps }: H264TrackConfig) {
    return box(
      "avcC",
      Buffer.from([1, sps[1] ?? 0x42, sps[2] ?? 0, sps[3] ?? 0x1f, 0xff, 0xe1]),
      uint16(sps.length),
      sps,
      Buffer.from([1]),
      uint16(pps.length),
      pps,
    );
  }

  private stts() {
    const entries = compactSttsEntries(this.samples);
    return fullBox(
      "stts",
      0,
      0,
      uint32(entries.length),
      ...entries.flatMap((entry) => [
        uint32(entry.count),
        uint32(entry.duration),
      ]),
    );
  }

  private stss() {
    const keySamples = this.samples
      .map((sample, index) => (sample.keyFrame ? index + 1 : 0))
      .filter((index) => index > 0);
    return fullBox(
      "stss",
      0,
      0,
      uint32(keySamples.length),
      ...keySamples.map(uint32),
    );
  }

  private stsc() {
    return fullBox(
      "stsc",
      0,
      0,
      uint32(1),
      uint32(1),
      uint32(this.samples.length),
      uint32(1),
    );
  }

  private stsz() {
    return fullBox(
      "stsz",
      0,
      0,
      uint32(0),
      uint32(this.samples.length),
      ...this.samples.map((sample) => uint32(sample.data.length)),
    );
  }

  private stco(mdatOffset: number) {
    return fullBox("stco", 0, 0, uint32(1), uint32(mdatOffset));
  }
}
