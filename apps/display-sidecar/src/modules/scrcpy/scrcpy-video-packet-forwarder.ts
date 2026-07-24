import type { ScrcpyPacket } from "./scrcpy-packet-parser";

export interface ScrcpyVideoPacketStats {
  configPackets: number;
  mediaPackets: number;
  keyFrames: number;
}

export interface ScrcpyVideoPacketForwardResult {
  packet: ScrcpyPacket | null;
  configPrepended: boolean;
  firstConfigPacket: boolean;
  firstMediaPacket: boolean;
  firstKeyFrame: boolean;
  stats: ScrcpyVideoPacketStats;
}

export class ScrcpyVideoPacketForwarder {
  private stats: ScrcpyVideoPacketStats = {
    configPackets: 0,
    mediaPackets: 0,
    keyFrames: 0,
  };

  accept(packet: ScrcpyPacket): ScrcpyVideoPacketForwardResult {
    let firstConfigPacket = false;
    if (packet.config) {
      this.stats = {
        ...this.stats,
        configPackets: this.stats.configPackets + 1,
      };
      firstConfigPacket = this.stats.configPackets === 1;
      return {
        packet,
        configPrepended: false,
        firstConfigPacket,
        firstMediaPacket: false,
        firstKeyFrame: false,
        stats: this.snapshot(),
      };
    }

    const mediaPackets = this.stats.mediaPackets + 1;
    const keyFrames = packet.keyFrame
      ? this.stats.keyFrames + 1
      : this.stats.keyFrames;
    this.stats = {
      ...this.stats,
      mediaPackets,
      keyFrames,
    };

    return {
      packet,
      configPrepended: false,
      firstConfigPacket,
      firstMediaPacket: mediaPackets === 1,
      firstKeyFrame: packet.keyFrame && keyFrames === 1,
      stats: this.snapshot(),
    };
  }

  snapshot(): ScrcpyVideoPacketStats {
    return { ...this.stats };
  }
}
