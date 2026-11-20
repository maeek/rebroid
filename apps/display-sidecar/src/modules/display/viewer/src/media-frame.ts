import {
  rbd1Flag,
  rbd1HeaderBytes,
  rbd1Magic,
  rbd1MediaKind,
  rbd1Offset,
  rbd1Version,
} from "./rbd1-header.js";

export type ViewerMediaFrame = {
  kind: keyof typeof rbd1MediaKind;
  sequence: number;
  timestampUs: number;
  config: boolean;
  keyFrame: boolean;
  discontinuity: boolean;
  data: Uint8Array<ArrayBuffer>;
};

export function parseViewerMediaFrame(buffer: ArrayBuffer): ViewerMediaFrame {
  const view = new DataView(buffer);
  if (
    view.byteLength < rbd1HeaderBytes ||
    view.getUint32(0) !== rbd1Magic ||
    view.getUint8(rbd1Offset.version) !== rbd1Version
  ) {
    throw new Error("Invalid RBD1 media frame.");
  }
  const kindValue = view.getUint8(rbd1Offset.kind);
  const kind =
    kindValue === rbd1MediaKind.video
      ? "video"
      : kindValue === rbd1MediaKind.audio
        ? "audio"
        : null;
  if (!kind) {
    throw new Error("Unsupported RBD1 media kind.");
  }
  const payloadLength = view.getUint32(rbd1Offset.payloadLength);
  if (!payloadLength || payloadLength !== view.byteLength - rbd1HeaderBytes) {
    throw new Error("Invalid RBD1 media payload length.");
  }
  const timestamp = view.getBigUint64(rbd1Offset.timestampUs);
  if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("RBD1 media timestamp exceeds browser precision.");
  }
  const flags = view.getUint16(rbd1Offset.flags);
  return {
    kind,
    sequence: view.getUint32(rbd1Offset.sequence),
    timestampUs: Number(timestamp),
    config: (flags & rbd1Flag.config) !== 0,
    keyFrame: (flags & rbd1Flag.keyFrame) !== 0,
    discontinuity: (flags & rbd1Flag.discontinuity) !== 0,
    data: new Uint8Array(buffer, rbd1HeaderBytes),
  };
}
