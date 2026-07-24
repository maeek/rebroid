export const SCRCPY_CODEC_H264 = 0x68323634;
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
  private readonly queue = new BufferChunkQueue();
  private codecRead = false;
  private pendingHeader: Buffer | null = null;
  private pendingPacketBytes = 0;

  constructor(private readonly options: ScrcpyPacketParserOptions) {}

  push(chunk: Buffer) {
    this.queue.push(chunk);

    if (!this.codecRead) {
      if (this.queue.byteLength < 4) {
        return;
      }
      const codec = this.queue.read(4).readUInt32BE(0);
      this.codecRead = true;
      if (codec === 0) {
        this.options.onDisabled?.();
        this.queue.clear();
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

    while (true) {
      if (!this.pendingHeader) {
        if (this.queue.byteLength < SCRCPY_PACKET_HEADER_BYTES) {
          return;
        }
        this.pendingHeader = this.queue.read(SCRCPY_PACKET_HEADER_BYTES);
      }

      if ((this.pendingHeader[0] & SCRCPY_PACKET_FLAG_SESSION) !== 0) {
        if (!this.options.allowSessionPackets) {
          throw new Error("Unexpected scrcpy session packet in audio stream");
        }
        this.options.onSessionPacket?.({
          width: this.pendingHeader.readUInt32BE(4),
          height: this.pendingHeader.readUInt32BE(8),
          clientResized: (this.pendingHeader[3] & 0x1) !== 0,
        });
        this.pendingHeader = null;
        continue;
      }

      if (!this.pendingPacketBytes) {
        this.pendingPacketBytes = this.pendingHeader.readUInt32BE(8);
      }
      if (
        !this.pendingPacketBytes ||
        this.pendingPacketBytes > MAX_SCRCPY_PACKET_BYTES
      ) {
        throw new Error(
          `Invalid scrcpy packet length: ${this.pendingPacketBytes}`,
        );
      }
      if (this.queue.byteLength < this.pendingPacketBytes) {
        return;
      }

      const header = this.pendingHeader;
      const ptsAndFlags = header.readBigUInt64BE(0);
      this.options.onPacket({
        data: this.queue.read(this.pendingPacketBytes),
        timestampUs: ptsAndFlags & SCRCPY_PACKET_PTS_MASK,
        config: (header[0] & SCRCPY_PACKET_FLAG_CONFIG) !== 0,
        keyFrame: (header[0] & SCRCPY_PACKET_FLAG_KEY_FRAME) !== 0,
      });
      this.pendingHeader = null;
      this.pendingPacketBytes = 0;
    }
  }
}

class BufferChunkQueue {
  private chunks: Buffer[] = [];
  private headIndex = 0;
  private headOffset = 0;
  byteLength = 0;

  push(chunk: Buffer): void {
    if (!chunk.byteLength) {
      return;
    }
    this.chunks.push(chunk);
    this.byteLength += chunk.byteLength;
  }

  read(bytes: number): Buffer {
    if (bytes < 0 || bytes > this.byteLength) {
      throw new RangeError(`Cannot read ${bytes} bytes from chunk queue`);
    }
    const head = this.chunks[this.headIndex];
    if (head && head.byteLength - this.headOffset >= bytes) {
      const value = head.subarray(this.headOffset, this.headOffset + bytes);
      this.consumeHead(bytes);
      return value;
    }

    const value = Buffer.allocUnsafe(bytes);
    let written = 0;
    while (written < bytes) {
      const chunk = this.chunks[this.headIndex]!;
      const available = chunk.byteLength - this.headOffset;
      const copied = Math.min(available, bytes - written);
      chunk.copy(value, written, this.headOffset, this.headOffset + copied);
      written += copied;
      this.consumeHead(copied);
    }
    return value;
  }

  clear(): void {
    this.chunks = [];
    this.headIndex = 0;
    this.headOffset = 0;
    this.byteLength = 0;
  }

  private consumeHead(bytes: number): void {
    this.headOffset += bytes;
    this.byteLength -= bytes;
    const head = this.chunks[this.headIndex];
    if (head && this.headOffset === head.byteLength) {
      this.headIndex += 1;
      this.headOffset = 0;
      if (this.headIndex >= 1_024 && this.headIndex * 2 >= this.chunks.length) {
        this.chunks = this.chunks.slice(this.headIndex);
        this.headIndex = 0;
      }
    }
  }
}
