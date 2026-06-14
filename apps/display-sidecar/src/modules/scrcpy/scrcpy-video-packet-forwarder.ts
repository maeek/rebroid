import type { ScrcpyPacket } from "./scrcpy-packet-parser";
import { ScrcpyVideoPacketMerger } from "./scrcpy-video-packet-merger";

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
  private readonly merger = new ScrcpyVideoPacketMerger();
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
    }

    const configPrepended = this.merger.hasPendingConfig();
    const mergedPacket = this.merger.merge(packet);
    if (!mergedPacket) {
      return {
        packet: null,
        configPrepended,
        firstConfigPacket,
        firstMediaPacket: false,
        firstKeyFrame: false,
        stats: this.snapshot(),
      };
    }

    const mediaPackets = this.stats.mediaPackets + 1;
    const keyFrames = mergedPacket.keyFrame
      ? this.stats.keyFrames + 1
      : this.stats.keyFrames;
    this.stats = {
      ...this.stats,
      mediaPackets,
      keyFrames,
    };

    return {
      packet: mergedPacket,
      configPrepended,
      firstConfigPacket,
      firstMediaPacket: mediaPackets === 1,
      firstKeyFrame: mergedPacket.keyFrame && keyFrames === 1,
      stats: this.snapshot(),
    };
  }

  snapshot(): ScrcpyVideoPacketStats {
    return { ...this.stats };
  }
}
