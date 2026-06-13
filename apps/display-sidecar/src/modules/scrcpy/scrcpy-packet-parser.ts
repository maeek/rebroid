export const SCRCPY_CODEC_H264 = 0x68323634;
export const SCRCPY_CODEC_H265 = 0x68323635;
export const SCRCPY_CODEC_OPUS = 0x6f707573;

const SCRCPY_PACKET_HEADER_BYTES = 12;
const SCRCPY_PACKET_FLAG_SESSION = 0x80;
const SCRCPY_PACKET_FLAG_CONFIG = 0x40;
const SCRCPY_PACKET_FLAG_KEY_FRAME = 0x20;
const SCRCPY_PACKET_PTS_MASK = (1n << 61n) - 1n;
const MAX_SCRCPY_PACKET_BYTES = 16 * 1024 * 1024;

export interface ScrcpyPacket {
  data: Buffer;
  timestampUs: bigint;
  config: boolean;
  keyFrame: boolean;
}

interface ScrcpySessionPacket {
  width: number;
  height: number;
  clientResized: boolean;
}

interface ScrcpyPacketParserOptions {
  expectedCodec: number;
  allowSessionPackets: boolean;
  onPacket: (packet: ScrcpyPacket) => void;
  onDisabled?: () => void;
  onSessionPacket?: (packet: ScrcpySessionPacket) => void;
}

export class ScrcpyPacketParser {
  private buffer = Buffer.alloc(0);
  private codecRead = false;

  constructor(private readonly options: ScrcpyPacketParserOptions) {}

  push(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    if (!this.codecRead) {
      if (this.buffer.length < 4) {
        return;
      }
      const codec = this.buffer.readUInt32BE(0);
      this.buffer = this.buffer.subarray(4);
      this.codecRead = true;
      if (codec === 0) {
        this.options.onDisabled?.();
        this.buffer = Buffer.alloc(0);
        return;
      }
      if (codec === 1) {
        throw new Error("scrcpy stream configuration failed on the device");
      }
      if (codec !== this.options.expectedCodec) {
        throw new Error(
          `Unexpected scrcpy stream codec: 0x${codec.toString(16)}`,
        );
      }
    }

    while (this.buffer.length >= SCRCPY_PACKET_HEADER_BYTES) {
      if ((this.buffer[0] & SCRCPY_PACKET_FLAG_SESSION) !== 0) {
        if (!this.options.allowSessionPackets) {
          throw new Error("Unexpected scrcpy session packet in audio stream");
        }
        this.options.onSessionPacket?.({
          width: this.buffer.readUInt32BE(4),
          height: this.buffer.readUInt32BE(8),
          clientResized: (this.buffer[3] & 0x1) !== 0,
        });
        this.buffer = this.buffer.subarray(SCRCPY_PACKET_HEADER_BYTES);
        continue;
      }

      const packetBytes = this.buffer.readUInt32BE(8);
      if (!packetBytes || packetBytes > MAX_SCRCPY_PACKET_BYTES) {
        throw new Error(`Invalid scrcpy packet length: ${packetBytes}`);
      }
      const totalBytes = SCRCPY_PACKET_HEADER_BYTES + packetBytes;
      if (this.buffer.length < totalBytes) {
        return;
      }

      const ptsAndFlags = this.buffer.readBigUInt64BE(0);
      this.options.onPacket({
        data: this.buffer.subarray(SCRCPY_PACKET_HEADER_BYTES, totalBytes),
        timestampUs: ptsAndFlags & SCRCPY_PACKET_PTS_MASK,
        config: (this.buffer[0] & SCRCPY_PACKET_FLAG_CONFIG) !== 0,
        keyFrame: (this.buffer[0] & SCRCPY_PACKET_FLAG_KEY_FRAME) !== 0,
      });
      this.buffer = this.buffer.subarray(totalBytes);
    }
  }
}
