import { ParsedStringPool, resStringPoolType } from '../types/apk.types';

export const scoreResourceIconPath = (path: string, density: number) => {
  const lowerPath = path.toLowerCase();
  let score = 5000;
  if (lowerPath.includes('.9.png')) score -= 2000;
  if (lowerPath.includes('foreground')) score -= 600;
  if (lowerPath.includes('background')) score -= 600;
  if (lowerPath.includes('monochrome')) score -= 1000;
  if (lowerPath.includes('mipmap')) score += 300;
  if (lowerPath.includes('launcher')) score += 250;
  if (lowerPath.includes('round')) score += 50;
  if (density === 65535) score += 250;
  if (density > 0 && density < 65535) score += Math.min(density, 640);
  return score;
};

export const readBinaryXmlResourceMap = (
  buffer: Buffer,
  offset: number,
  size: number,
) => {
  const resourceMap: number[] = [];
  for (
    let cursor = offset + readChunkHeaderSize(buffer, offset);
    cursor + 4 <= offset + size;
    cursor += 4
  ) {
    resourceMap.push(buffer.readUInt32LE(cursor));
  }
  return resourceMap;
};

export const readBinaryXmlStringPool = (
  buffer: Buffer,
  offset: number,
): ParsedStringPool => {
  if (
    offset + 28 > buffer.length ||
    buffer.readUInt16LE(offset) !== resStringPoolType
  ) {
    return { strings: [] };
  }

  const headerSize = readChunkHeaderSize(buffer, offset);
  const chunkSize = buffer.readUInt32LE(offset + 4);
  const stringCount = buffer.readUInt32LE(offset + 8);
  const flags = buffer.readUInt32LE(offset + 16);
  const stringsStart = offset + buffer.readUInt32LE(offset + 20);
  const isUtf8 = (flags & 0x00000100) !== 0;
  const strings: string[] = [];

  for (let index = 0; index < stringCount; index += 1) {
    const stringOffsetPosition = offset + headerSize + index * 4;
    if (stringOffsetPosition + 4 > offset + chunkSize) {
      break;
    }

    const stringOffset =
      stringsStart + buffer.readUInt32LE(stringOffsetPosition);
    strings.push(
      isUtf8
        ? readUtf8String(buffer, stringOffset)
        : readUtf16String(buffer, stringOffset),
    );
  }

  return { strings };
};

export const readUtf8String = (buffer: Buffer, offset: number) => {
  const firstLength = readLength8(buffer, offset);
  const secondLength = readLength8(buffer, firstLength.nextOffset);
  const start = secondLength.nextOffset;
  return buffer.toString('utf-8', start, start + secondLength.length);
};

export const readUtf16String = (buffer: Buffer, offset: number) => {
  const length = readLength16(buffer, offset);
  const start = length.nextOffset;
  return buffer.toString('utf16le', start, start + length.length * 2);
};

export const readLength8 = (buffer: Buffer, offset: number) => {
  const first = buffer.readUInt8(offset);
  if ((first & 0x80) === 0) {
    return { length: first, nextOffset: offset + 1 };
  }

  return {
    length: ((first & 0x7f) << 8) | buffer.readUInt8(offset + 1),
    nextOffset: offset + 2,
  };
};

export const readLength16 = (buffer: Buffer, offset: number) => {
  const first = buffer.readUInt16LE(offset);
  if ((first & 0x8000) === 0) {
    return { length: first, nextOffset: offset + 2 };
  }

  return {
    length: ((first & 0x7fff) << 16) | buffer.readUInt16LE(offset + 2),
    nextOffset: offset + 4,
  };
};

export const readChunkHeaderSize = (buffer: Buffer, offset: number) =>
  offset + 4 <= buffer.length ? buffer.readUInt16LE(offset + 2) : 8;
