export type StartCodeOffset = {
  index: number;
  length: 3 | 4;
};

export function concatBytes(
  parts: Uint8Array<ArrayBufferLike>[],
): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function findStartCodes(
  bytes: Uint8Array<ArrayBufferLike>,
): StartCodeOffset[] {
  const offsets: StartCodeOffset[] = [];
  for (let i = 0; i < bytes.length - 3; i += 1) {
    if (bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 1) {
      offsets.push({ index: i, length: 3 });
      i += 2;
    } else if (
      bytes[i] === 0 &&
      bytes[i + 1] === 0 &&
      bytes[i + 2] === 0 &&
      bytes[i + 3] === 1
    ) {
      offsets.push({ index: i, length: 4 });
      i += 3;
    }
  }
  return offsets;
}
