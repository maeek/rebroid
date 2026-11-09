import { stripVTControlCharacters } from 'node:util';

export const displaySidecarLogLimits = {
  preview: { lines: 20, bytes: 8 * 1024, readBytes: 256 * 1024 },
  expanded: { lines: 200, bytes: 96 * 1024, readBytes: 2 * 1024 * 1024 },
} as const;

export const displaySidecarLogTail = (
  raw: string,
  limits: { lines: number; bytes: number },
) => {
  const lines = stripVTControlCharacters(raw)
    .replaceAll('\r\n', '\n')
    .replace(/\n$/, '')
    .split('\n');
  const output = lines.slice(-limits.lines).join('\n');
  const bytes = Buffer.from(output);
  if (bytes.length <= limits.bytes) {
    return {
      output,
      lineLimit: limits.lines,
      truncated: lines.length > limits.lines,
    };
  }

  let start = bytes.length - limits.bytes;
  const nextLine = bytes.indexOf(10, start);
  if (bytes[start - 1] !== 10 && nextLine >= 0 && nextLine < bytes.length - 1) {
    start = nextLine + 1;
  } else {
    // If the newest line alone exceeds the limit, keep its end at a UTF-8 boundary.
    while ((bytes[start] & 0xc0) === 0x80) start++;
  }

  return {
    output: bytes.toString('utf8', start),
    lineLimit: limits.lines,
    truncated: true,
  };
};
