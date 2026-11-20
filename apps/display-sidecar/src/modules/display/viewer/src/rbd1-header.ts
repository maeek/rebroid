export const rbd1Magic = 0x52424431;
export const rbd1Version = 1;
export const rbd1HeaderBytes = 24;

export const rbd1Offset = {
  version: 4,
  kind: 5,
  flags: 6,
  sequence: 8,
  timestampUs: 12,
  payloadLength: 20,
} as const;

export const rbd1MediaKind = { video: 1, audio: 2 } as const;

export const rbd1Flag = {
  config: 1 << 0,
  keyFrame: 1 << 1,
  discontinuity: 1 << 2,
} as const;
