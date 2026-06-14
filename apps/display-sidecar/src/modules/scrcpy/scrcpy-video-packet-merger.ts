import type { ScrcpyPacket } from "./scrcpy-packet-parser";

export class ScrcpyVideoPacketMerger {
  private configPacket: Buffer | null = null;

  merge(packet: ScrcpyPacket): ScrcpyPacket | null {
    if (packet.config) {
      this.configPacket = Buffer.from(packet.data);
      return null;
    }

    if (!this.configPacket) {
      return packet;
    }

    const data = Buffer.concat([this.configPacket, packet.data]);
    this.configPacket = null;
    return {
      ...packet,
      data,
    };
  }

  hasPendingConfig() {
    return this.configPacket !== null;
  }
}
