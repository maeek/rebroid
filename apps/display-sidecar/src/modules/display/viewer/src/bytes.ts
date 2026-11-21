// Returned NAL units borrow the packet's buffer. Copy any unit retained beyond the packet.
export function splitAnnexBPacket(bytes: Uint8Array): Uint8Array[] {
  const nals: Uint8Array[] = [];
  let start: number | undefined;
  for (let index = 0; index + 2 < bytes.byteLength; index += 1) {
    if (bytes[index] !== 0 || bytes[index + 1] !== 0) continue;
    let length: number;
    if (bytes[index + 2] === 1) length = 3;
    else if (bytes[index + 2] === 0 && bytes[index + 3] === 1) length = 4;
    else continue;

    if (start !== undefined && start < index)
      nals.push(bytes.subarray(start, index));
    start = index + length;
    index = start - 1;
  }
  if (start !== undefined && start < bytes.byteLength)
    nals.push(bytes.subarray(start));
  return nals;
}
