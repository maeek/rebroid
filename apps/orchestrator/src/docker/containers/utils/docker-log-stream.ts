const frameHeaderBytes = 8;

const hasFrameHeader = (buffer: Buffer, offset: number) =>
  buffer.length - offset >= frameHeaderBytes &&
  buffer[offset] <= 3 &&
  buffer[offset + 1] === 0 &&
  buffer[offset + 2] === 0 &&
  buffer[offset + 3] === 0;

export const decodeDockerLogStream = (buffer: Buffer): string => {
  // TTY logs and some Docker-compatible engines return plain text.
  if (!hasFrameHeader(buffer, 0)) return buffer.toString('utf8');

  const payloads: Buffer[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    if (!hasFrameHeader(buffer, offset)) {
      throw new Error('Invalid container log frame header.');
    }
    const payloadStart = offset + frameHeaderBytes;
    const next = payloadStart + buffer.readUInt32BE(offset + 4);
    if (next > buffer.length) {
      throw new Error('Incomplete container log frame.');
    }
    payloads.push(buffer.subarray(payloadStart, next));
    offset = next;
  }
  return Buffer.concat(payloads).toString('utf8');
};
