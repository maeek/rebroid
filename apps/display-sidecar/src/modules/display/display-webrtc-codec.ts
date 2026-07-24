export interface CompatibleH264Offer {
  payloadType: string;
  profileLevelId: string;
}

type H264ProfileClass =
  | "constrained-baseline"
  | "baseline"
  | "main"
  | "extended"
  | "constrained-high"
  | "high";

function h264ProfileClass(profileLevelId: string): H264ProfileClass | null {
  if (!/^[0-9a-f]{6}$/i.test(profileLevelId)) {
    return null;
  }
  const profileIdc = Number.parseInt(profileLevelId.slice(0, 2), 16);
  const constraints = Number.parseInt(profileLevelId.slice(2, 4), 16);
  if (profileIdc === 0x42) {
    return constraints & 0x40 ? "constrained-baseline" : "baseline";
  }
  if (profileIdc === 0x4d) {
    return constraints & 0x80 ? "constrained-baseline" : "main";
  }
  if (profileIdc === 0x58) {
    return constraints & 0x80 ? "constrained-baseline" : "extended";
  }
  if (profileIdc === 0x64) {
    return (constraints & 0x0c) === 0x0c ? "constrained-high" : "high";
  }
  return null;
}

function fmtpParameter(fmtp: string, name: string): string | undefined {
  for (const parameter of fmtp.split(";")) {
    const [key, value] = parameter.trim().split("=", 2);
    if (key?.toLowerCase() === name) {
      return value?.trim().toLowerCase();
    }
  }
  return undefined;
}

export function findCompatibleH264Offer(
  offerSdp: string,
  sourceProfileLevelId: string,
): CompatibleH264Offer | null {
  const sourceProfile = h264ProfileClass(sourceProfileLevelId);
  if (!sourceProfile) {
    return null;
  }
  const payloadTypes = new Set<string>();
  const fmtpByPayload = new Map<string, string>();
  for (const line of offerSdp.split(/\r?\n/)) {
    const rtpMap = line.match(/^a=rtpmap:(\d+)\s+H264\/90000/i);
    if (rtpMap?.[1]) {
      payloadTypes.add(rtpMap[1]);
      continue;
    }
    const fmtp = line.match(/^a=fmtp:(\d+)\s+(.+)$/i);
    if (fmtp?.[1] && fmtp[2]) {
      fmtpByPayload.set(fmtp[1], fmtp[2]);
    }
  }
  for (const payloadType of payloadTypes) {
    const fmtp = fmtpByPayload.get(payloadType) ?? "";
    if (fmtpParameter(fmtp, "packetization-mode") !== "1") {
      continue;
    }
    const profileLevelId = fmtpParameter(fmtp, "profile-level-id") ?? "42e01f";
    if (h264ProfileClass(profileLevelId) !== sourceProfile) {
      continue;
    }
    const levelAsymmetryAllowed =
      fmtpParameter(fmtp, "level-asymmetry-allowed") === "1";
    const offeredLevel = Number.parseInt(profileLevelId.slice(4), 16);
    const sourceLevel = Number.parseInt(sourceProfileLevelId.slice(4), 16);
    if (!levelAsymmetryAllowed && offeredLevel < sourceLevel) {
      continue;
    }
    return { payloadType, profileLevelId };
  }
  return null;
}
