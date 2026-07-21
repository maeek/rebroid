import {
  noEntry,
  ParsedStringPool,
  resStringPoolType,
  resTableTypeType,
  resTableType,
  resXmlResourceMapType,
  resXmlStartElementType,
} from '../types/apk.types';

interface BinaryResourceChunk {
  offset: number;
  type: number;
  headerSize: number;
  size: number;
}

interface BinaryXmlAttribute {
  nameIndex: number;
  rawValueIndex: number;
  dataType: number;
  data: number;
}

interface NamedBinaryXmlAttribute extends BinaryXmlAttribute {
  name?: string;
  rawValue?: string;
  resourceId?: number;
  strings: string[];
}

interface SimpleResourceEntry {
  resourceId: number;
  dataType: number;
  data: number;
  density: number;
}

export function* readBinaryResourceChunks(
  buffer: Buffer,
  startOffset = readChunkHeaderSize(buffer, 0),
  endOffset = buffer.length,
): Generator<BinaryResourceChunk> {
  const end = Math.min(Math.max(endOffset, 0), buffer.length);
  let offset = Math.max(startOffset, 0);
  while (offset + 8 <= end) {
    const type = buffer.readUInt16LE(offset);
    const headerSize = buffer.readUInt16LE(offset + 2);
    const size = buffer.readUInt32LE(offset + 4);
    if (
      size < 8 ||
      headerSize < 8 ||
      headerSize > size ||
      offset + size > end
    ) {
      break;
    }
    yield { offset, type, headerSize, size };
    offset += size;
  }
}

export function* readBinaryXmlAttributes(
  buffer: Buffer,
  chunk: BinaryResourceChunk,
): Generator<BinaryXmlAttribute> {
  if (chunk.size < 36 || chunk.offset + 30 > buffer.length) return;

  const attributesStart =
    chunk.offset + 16 + buffer.readUInt16LE(chunk.offset + 24);
  const attributeSize = buffer.readUInt16LE(chunk.offset + 26);
  const attributeCount = buffer.readUInt16LE(chunk.offset + 28);
  const chunkEnd = Math.min(chunk.offset + chunk.size, buffer.length);
  if (attributeSize < 20 || attributesStart < chunk.offset) return;

  for (let index = 0; index < attributeCount; index += 1) {
    const offset = attributesStart + index * attributeSize;
    if (offset + 20 > chunkEnd) break;
    yield {
      nameIndex: buffer.readUInt32LE(offset + 4),
      rawValueIndex: buffer.readUInt32LE(offset + 8),
      dataType: buffer.readUInt8(offset + 15),
      data: buffer.readUInt32LE(offset + 16),
    };
  }
}

export const readBinaryXmlElementAttributes = (
  buffer: Buffer,
  elementName: string,
): NamedBinaryXmlAttribute[] => {
  let strings: string[] = [];
  let resourceMap: number[] = [];
  for (const chunk of readBinaryResourceChunks(buffer)) {
    if (chunk.type === resStringPoolType) {
      strings = readBinaryXmlStringPool(buffer, chunk.offset).strings;
      continue;
    }
    if (chunk.type === resXmlResourceMapType) {
      resourceMap = readBinaryXmlResourceMap(buffer, chunk.offset, chunk.size);
      continue;
    }
    if (chunk.type !== resXmlStartElementType || chunk.size < 36) continue;
    const nameIndex = buffer.readUInt32LE(chunk.offset + 20);
    if (strings[nameIndex] !== elementName) continue;

    return [...readBinaryXmlAttributes(buffer, chunk)].map((attribute) => ({
      ...attribute,
      name: strings[attribute.nameIndex],
      rawValue:
        attribute.rawValueIndex === noEntry
          ? undefined
          : strings[attribute.rawValueIndex],
      resourceId: resourceMap[attribute.nameIndex],
      strings,
    }));
  }
  return [];
};

export const readResourceTableHeader = (buffer: Buffer) => {
  if (buffer.length < 12 || buffer.readUInt16LE(0) !== resTableType) {
    return null;
  }
  const stringPoolOffset = readChunkHeaderSize(buffer, 0);
  const stringPoolChunk = readBinaryResourceChunks(
    buffer,
    stringPoolOffset,
  ).next().value;
  if (!stringPoolChunk || stringPoolChunk.type !== resStringPoolType) {
    return null;
  }
  return {
    stringPool: readBinaryXmlStringPool(buffer, stringPoolChunk.offset),
    packagesOffset: stringPoolChunk.offset + stringPoolChunk.size,
  };
};

export function* readSimpleResourceEntries(
  buffer: Buffer,
  packageOffset: number,
  packageSize: number,
): Generator<SimpleResourceEntry> {
  if (packageOffset + 284 > buffer.length) return;

  const packageId = buffer.readUInt32LE(packageOffset + 8);
  const packageEnd = Math.min(packageOffset + packageSize, buffer.length);
  const entriesStartOffset =
    packageOffset + buffer.readUInt16LE(packageOffset + 2);
  for (const chunk of readBinaryResourceChunks(
    buffer,
    entriesStartOffset,
    packageEnd,
  )) {
    if (chunk.type !== resTableTypeType || chunk.headerSize < 20) continue;
    const typeId = buffer.readUInt8(chunk.offset + 8);
    const entryCount = buffer.readUInt32LE(chunk.offset + 12);
    const valuesStart = buffer.readUInt32LE(chunk.offset + 16);
    const offsetsStart = chunk.offset + chunk.headerSize;
    const density =
      chunk.offset + 36 <= buffer.length
        ? buffer.readUInt16LE(chunk.offset + 34)
        : 0;

    for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
      const entryOffsetPosition = offsetsStart + entryIndex * 4;
      if (entryOffsetPosition + 4 > chunk.offset + chunk.size) break;
      const entryOffset = buffer.readUInt32LE(entryOffsetPosition);
      if (entryOffset === noEntry) continue;

      const valueOffset = chunk.offset + valuesStart + entryOffset;
      if (valueOffset + 16 > chunk.offset + chunk.size) continue;
      const flags = buffer.readUInt16LE(valueOffset + 2);
      if ((flags & 0x0001) !== 0) continue;

      yield {
        resourceId: packageId * 0x01000000 + typeId * 0x00010000 + entryIndex,
        dataType: buffer.readUInt8(valueOffset + 11),
        data: buffer.readUInt32LE(valueOffset + 12),
        density,
      };
    }
  }
}

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
  const end = Math.min(offset + size, buffer.length);
  for (
    let cursor = offset + readChunkHeaderSize(buffer, offset);
    cursor + 4 <= end;
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
  const chunkEnd = offset + chunkSize;
  if (headerSize < 28 || chunkSize < headerSize || chunkEnd > buffer.length) {
    return { strings: [] };
  }
  const stringCount = buffer.readUInt32LE(offset + 8);
  const flags = buffer.readUInt32LE(offset + 16);
  const stringsStart = offset + buffer.readUInt32LE(offset + 20);
  const isUtf8 = (flags & 0x00000100) !== 0;
  const strings: string[] = [];

  const availableOffsets = Math.floor((chunkSize - headerSize) / 4);
  const boundedStringCount = Math.min(stringCount, availableOffsets);
  for (let index = 0; index < boundedStringCount; index += 1) {
    const stringOffsetPosition = offset + headerSize + index * 4;
    if (stringOffsetPosition + 4 > offset + chunkSize) {
      break;
    }

    const stringOffset =
      stringsStart + buffer.readUInt32LE(stringOffsetPosition);
    if (stringOffset >= chunkEnd) break;
    strings.push(
      isUtf8
        ? readUtf8String(buffer, stringOffset, chunkEnd)
        : readUtf16String(buffer, stringOffset, chunkEnd),
    );
  }

  return { strings };
};

export const readUtf8String = (
  buffer: Buffer,
  offset: number,
  endOffset = buffer.length,
) => {
  if (offset < 0 || offset >= endOffset || offset >= buffer.length) return '';
  const firstLength = readLength8(buffer, offset);
  if (firstLength.nextOffset >= endOffset) return '';
  const secondLength = readLength8(buffer, firstLength.nextOffset);
  const start = secondLength.nextOffset;
  return buffer.toString(
    'utf-8',
    start,
    Math.min(start + secondLength.length, endOffset, buffer.length),
  );
};

export const readUtf16String = (
  buffer: Buffer,
  offset: number,
  endOffset = buffer.length,
) => {
  if (offset < 0 || offset + 2 > endOffset || offset + 2 > buffer.length) {
    return '';
  }
  const length = readLength16(buffer, offset);
  const start = length.nextOffset;
  return buffer.toString(
    'utf16le',
    start,
    Math.min(start + length.length * 2, endOffset, buffer.length),
  );
};

export const readLength8 = (buffer: Buffer, offset: number) => {
  if (offset < 0 || offset >= buffer.length) {
    return { length: 0, nextOffset: buffer.length };
  }
  const first = buffer.readUInt8(offset);
  if ((first & 0x80) === 0) {
    return { length: first, nextOffset: offset + 1 };
  }

  if (offset + 1 >= buffer.length) {
    return { length: 0, nextOffset: buffer.length };
  }
  return {
    length: ((first & 0x7f) << 8) | buffer.readUInt8(offset + 1),
    nextOffset: offset + 2,
  };
};

export const readLength16 = (buffer: Buffer, offset: number) => {
  if (offset < 0 || offset + 2 > buffer.length) {
    return { length: 0, nextOffset: buffer.length };
  }
  const first = buffer.readUInt16LE(offset);
  if ((first & 0x8000) === 0) {
    return { length: first, nextOffset: offset + 2 };
  }

  if (offset + 4 > buffer.length) {
    return { length: 0, nextOffset: buffer.length };
  }
  return {
    length: ((first & 0x7fff) << 16) | buffer.readUInt16LE(offset + 2),
    nextOffset: offset + 4,
  };
};

export const readChunkHeaderSize = (buffer: Buffer, offset: number) =>
  offset + 4 <= buffer.length ? buffer.readUInt16LE(offset + 2) : 8;
