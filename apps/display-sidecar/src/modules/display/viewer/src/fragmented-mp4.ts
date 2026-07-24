import { annexBToAvcSample, avcDecoderConfigurationRecord } from "./h264.js";

const videoTimescale = 90_000;

export interface FragmentedMp4Configuration {
  codec: string;
  sps: Uint8Array<ArrayBufferLike>;
  pps: Uint8Array<ArrayBufferLike>;
  width: number;
  height: number;
}

export interface FragmentedMp4Sample {
  sequence: number;
  timestampUs: number;
  keyFrame: boolean;
  data: Uint8Array<ArrayBufferLike>;
}

export interface FragmentedMp4Fragment {
  segment: ArrayBuffer;
  samples: Array<{ sequence: number; timestampUs: number }>;
  durationMs: number;
  sourcePtsOriginUs: number;
}

const ascii = (value: string) =>
  Uint8Array.from([...value].map((character) => character.charCodeAt(0)));

const bytes = (...values: number[]) => Uint8Array.from(values);

function uint16(value: number): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(2);
  new DataView(output.buffer).setUint16(0, value);
  return output;
}

function uint32(value: number): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(4);
  new DataView(output.buffer).setUint32(0, value >>> 0);
  return output;
}

function uint64(value: bigint): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(8);
  new DataView(output.buffer).setBigUint64(0, value);
  return output;
}

function concat(parts: Uint8Array<ArrayBufferLike>[]): Uint8Array<ArrayBuffer> {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function box(
  type: string,
  ...payload: Uint8Array<ArrayBufferLike>[]
): Uint8Array<ArrayBuffer> {
  const body = concat(payload);
  return concat([uint32(body.byteLength + 8), ascii(type), body]);
}

function fullBox(
  type: string,
  version: number,
  flags: number,
  ...payload: Uint8Array<ArrayBufferLike>[]
): Uint8Array<ArrayBuffer> {
  return box(
    type,
    bytes(version, (flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff),
    ...payload,
  );
}

const zeros = (count: number) => new Uint8Array(count);

const identityMatrix = concat([
  uint32(0x00010000),
  uint32(0),
  uint32(0),
  uint32(0),
  uint32(0x00010000),
  uint32(0),
  uint32(0),
  uint32(0),
  uint32(0x40000000),
]);

function movieHeader(): Uint8Array<ArrayBuffer> {
  return fullBox(
    "mvhd",
    0,
    0,
    uint32(0),
    uint32(0),
    uint32(videoTimescale),
    uint32(0),
    uint32(0x00010000),
    uint16(0x0100),
    zeros(10),
    identityMatrix,
    zeros(24),
    uint32(2),
  );
}

function trackHeader(width: number, height: number): Uint8Array<ArrayBuffer> {
  return fullBox(
    "tkhd",
    0,
    0x000007,
    uint32(0),
    uint32(0),
    uint32(1),
    uint32(0),
    uint32(0),
    zeros(8),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    identityMatrix,
    uint32(width * 0x10000),
    uint32(height * 0x10000),
  );
}

function mediaHeader(): Uint8Array<ArrayBuffer> {
  return fullBox(
    "mdhd",
    0,
    0,
    uint32(0),
    uint32(0),
    uint32(videoTimescale),
    uint32(0),
    uint16(0x55c4),
    uint16(0),
  );
}

function handler(): Uint8Array<ArrayBuffer> {
  return fullBox(
    "hdlr",
    0,
    0,
    uint32(0),
    ascii("vide"),
    zeros(12),
    ascii("Rebroid Video\0"),
  );
}

function avcSampleEntry(
  configuration: FragmentedMp4Configuration,
): Uint8Array<ArrayBuffer> {
  const compressorName = new Uint8Array(32);
  const label = ascii("Rebroid H.264");
  compressorName[0] = label.byteLength;
  compressorName.set(label, 1);
  const avcC = avcDecoderConfigurationRecord(
    configuration.sps,
    configuration.pps,
  );
  return box(
    "avc1",
    zeros(6),
    uint16(1),
    zeros(16),
    uint16(configuration.width),
    uint16(configuration.height),
    uint32(0x00480000),
    uint32(0x00480000),
    uint32(0),
    uint16(1),
    compressorName,
    uint16(0x0018),
    uint16(0xffff),
    box("avcC", avcC),
  );
}

function sampleTable(
  configuration: FragmentedMp4Configuration,
): Uint8Array<ArrayBuffer> {
  return box(
    "stbl",
    fullBox("stsd", 0, 0, uint32(1), avcSampleEntry(configuration)),
    fullBox("stts", 0, 0, uint32(0)),
    fullBox("stsc", 0, 0, uint32(0)),
    fullBox("stsz", 0, 0, uint32(0), uint32(0)),
    fullBox("stco", 0, 0, uint32(0)),
  );
}

function mediaInformation(
  configuration: FragmentedMp4Configuration,
): Uint8Array<ArrayBuffer> {
  const dataReference = fullBox("dref", 0, 0, uint32(1), fullBox("url ", 0, 1));
  return box(
    "minf",
    fullBox("vmhd", 0, 1, uint16(0), uint16(0), uint16(0), uint16(0)),
    box("dinf", dataReference),
    sampleTable(configuration),
  );
}

function initializationSegment(
  configuration: FragmentedMp4Configuration,
): ArrayBuffer {
  const fileType = box(
    "ftyp",
    ascii("isom"),
    uint32(0x00000200),
    ascii("isom"),
    ascii("iso6"),
    ascii("avc1"),
    ascii("mp41"),
  );
  const media = box(
    "mdia",
    mediaHeader(),
    handler(),
    mediaInformation(configuration),
  );
  const track = box(
    "trak",
    trackHeader(configuration.width, configuration.height),
    media,
  );
  const extendsBox = box(
    "mvex",
    fullBox(
      "trex",
      0,
      0,
      uint32(1),
      uint32(1),
      uint32(0),
      uint32(0),
      uint32(0),
    ),
  );
  return concat([fileType, box("moov", movieHeader(), track, extendsBox)])
    .buffer;
}

function sampleFlags(keyFrame: boolean): number {
  return keyFrame ? 0x02000000 : 0x01010000;
}

function movieFragment(
  fragmentSequence: number,
  baseDecodeTime: bigint,
  samples: Array<{
    duration: number;
    size: number;
    keyFrame: boolean;
  }>,
): Uint8Array<ArrayBuffer> {
  const makeTrackFragment = (dataOffset: number) =>
    box(
      "traf",
      fullBox("tfhd", 0, 0x020000, uint32(1)),
      fullBox("tfdt", 1, 0, uint64(baseDecodeTime)),
      fullBox(
        "trun",
        0,
        0x000701,
        uint32(samples.length),
        uint32(dataOffset),
        ...samples.flatMap((sample) => [
          uint32(sample.duration),
          uint32(sample.size),
          uint32(sampleFlags(sample.keyFrame)),
        ]),
      ),
    );
  const movieFragmentHeader = fullBox("mfhd", 0, 0, uint32(fragmentSequence));
  let moof = box("moof", movieFragmentHeader, makeTrackFragment(0));
  moof = box(
    "moof",
    movieFragmentHeader,
    makeTrackFragment(moof.byteLength + 8),
  );
  return moof;
}

function timestampTicks(timestampUs: number): bigint {
  return BigInt(Math.max(0, Math.round((timestampUs * videoTimescale) / 1e6)));
}

export class FragmentedMp4Muxer {
  private fragmentSequence = 1;
  private sourcePtsOriginUs: number | null = null;
  private lastDurationUs = 16_667;
  private codec = "";

  initialize(configuration: FragmentedMp4Configuration): {
    segment: ArrayBuffer;
    codec: string;
    width: number;
    height: number;
  } {
    if (
      !Number.isInteger(configuration.width) ||
      !Number.isInteger(configuration.height) ||
      configuration.width <= 0 ||
      configuration.height <= 0
    ) {
      throw new Error("H.264 SPS does not contain valid display dimensions.");
    }
    this.fragmentSequence = 1;
    this.sourcePtsOriginUs = null;
    this.lastDurationUs = 16_667;
    this.codec = configuration.codec;
    return {
      segment: initializationSegment(configuration),
      codec: configuration.codec,
      width: configuration.width,
      height: configuration.height,
    };
  }

  fragment(
    inputSamples: FragmentedMp4Sample[],
    nextTimestampUs?: number,
  ): FragmentedMp4Fragment {
    if (!this.codec || inputSamples.length === 0) {
      throw new Error("Fragmented MP4 muxer is not initialized.");
    }
    for (let index = 1; index < inputSamples.length; index += 1) {
      if (
        inputSamples[index]!.timestampUs <= inputSamples[index - 1]!.timestampUs
      ) {
        throw new Error("H.264 PTS must advance without B-frame reordering.");
      }
    }
    const firstTimestampUs = inputSamples[0]!.timestampUs;
    this.sourcePtsOriginUs ??= firstTimestampUs;
    if (firstTimestampUs < this.sourcePtsOriginUs) {
      throw new Error("H.264 PTS regressed across an MP4 discontinuity.");
    }

    const avcSamples = inputSamples.map((sample) => ({
      ...sample,
      data: annexBToAvcSample(sample.data),
    }));
    const encodedSamples = avcSamples.map((sample, index) => {
      const followingTimestamp =
        avcSamples[index + 1]?.timestampUs ?? nextTimestampUs;
      const durationUs =
        followingTimestamp !== undefined &&
        followingTimestamp > sample.timestampUs
          ? followingTimestamp - sample.timestampUs
          : this.lastDurationUs;
      this.lastDurationUs = durationUs;
      return {
        duration: Math.max(1, Math.round((durationUs * videoTimescale) / 1e6)),
        size: sample.data.byteLength,
        keyFrame: sample.keyFrame,
      };
    });
    const baseDecodeTime = timestampTicks(
      firstTimestampUs - this.sourcePtsOriginUs,
    );
    const moof = movieFragment(
      this.fragmentSequence++,
      baseDecodeTime,
      encodedSamples,
    );
    const mediaData = box(
      "mdat",
      concat(avcSamples.map((sample) => sample.data)),
    );
    const segment = concat([moof, mediaData]).buffer;
    const durationMs =
      encodedSamples.reduce((sum, sample) => sum + sample.duration, 0) /
      (videoTimescale / 1_000);
    return {
      segment,
      samples: inputSamples.map(({ sequence, timestampUs }) => ({
        sequence,
        timestampUs,
      })),
      durationMs,
      sourcePtsOriginUs: this.sourcePtsOriginUs,
    };
  }
}
