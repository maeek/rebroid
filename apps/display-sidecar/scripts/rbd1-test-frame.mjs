import { encodeRebroidMediaFrame } from "../dist/modules/scrcpy/scrcpy-media-frame.js";

export const rbd1 = ({
  sequence,
  timestampUs,
  kind = 1,
  config = false,
  key = false,
  discontinuity = false,
  data,
}) => {
  const output = encodeRebroidMediaFrame({
    sequence,
    timestampUs: BigInt(timestampUs),
    kind: kind === 2 ? "audio" : "video",
    config,
    keyFrame: key,
    discontinuity,
    data: Buffer.from(data),
  });
  return new Uint8Array(output).buffer;
};
