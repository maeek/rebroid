const mediaMagic = [0x52, 0x42, 0x44, 0x31] as const;
const mediaHeaderBytes = 24;
const mediaVersion = 1;

export const viewerMediaKind = {
  video: 1,
  audio: 2,
} as const;

const mediaFlag = {
  config: 1 << 0,
  keyFrame: 1 << 1,
  discontinuity: 1 << 2,
} as const;

export type ViewerMediaFrame = {
  kind: keyof typeof viewerMediaKind;
  sequence: number;
  timestampUs: number;
  config: boolean;
  keyFrame: boolean;
  discontinuity: boolean;
  data: Uint8Array<ArrayBuffer>;
};

export function parseViewerMediaFrame(buffer: ArrayBuffer): ViewerMediaFrame {
  const bytes = new Uint8Array(buffer);
  if (
    bytes.byteLength < mediaHeaderBytes ||
    mediaMagic.some((value, index) => bytes[index] !== value) ||
    bytes[4] !== mediaVersion
  ) {
    throw new Error("Invalid RBD1 media frame.");
  }
  const view = new DataView(buffer);
  const kindValue = bytes[5];
  const kind =
    kindValue === viewerMediaKind.video
      ? "video"
      : kindValue === viewerMediaKind.audio
        ? "audio"
        : null;
  if (!kind) {
    throw new Error("Unsupported RBD1 media kind.");
  }
  const payloadLength = view.getUint32(20);
  if (!payloadLength || payloadLength !== bytes.byteLength - mediaHeaderBytes) {
    throw new Error("Invalid RBD1 media payload length.");
  }
  const timestamp = view.getBigUint64(12);
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("RBD1 media timestamp exceeds browser precision.");
  }
  const flags = view.getUint16(6);
  return {
    kind,
    sequence: view.getUint32(8),
    timestampUs: Number(timestamp),
    config: (flags & mediaFlag.config) !== 0,
    keyFrame: (flags & mediaFlag.keyFrame) !== 0,
    discontinuity: (flags & mediaFlag.discontinuity) !== 0,
    data: bytes.subarray(mediaHeaderBytes),
  };
}
