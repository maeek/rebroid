import { splitAnnexBPacket } from "../display/viewer/src/bytes";
import { h264DimensionsFromSps } from "../display/viewer/src/h264-sps";
import type { ScrcpyPacket } from "./scrcpy-packet-parser";

interface ScrcpyH264Configuration {
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

export function inspectScrcpyH264Configuration(
  packet: Pick<ScrcpyPacket, "data">,
): ScrcpyH264Configuration {
  const sps = splitAnnexBPacket(packet.data).find(
    (nal) => (nal[0]! & 0x1f) === 7,
  );
  if (!sps || sps.byteLength < 4) {
    throw new Error("H.264 bootstrap configuration is missing SPS");
  }
  const profileLevelId = Buffer.from(sps.subarray(1, 4))
    .toString("hex")
    .toLowerCase();
  return {
    profileLevelId,
    sdpFmtpLine: `level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=${profileLevelId}`,
    ...h264DimensionsFromSps(sps),
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
