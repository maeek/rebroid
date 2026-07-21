import {
  readBinaryXmlResourceMap,
  readBinaryResourceChunks,
  readBinaryXmlAttributes,
  readBinaryXmlStringPool,
  readChunkHeaderSize,
  readLength16,
  readLength8,
  readResourceTableHeader,
  readSimpleResourceEntries,
  readUtf16String,
  readUtf8String,
  scoreResourceIconPath,
} from './apk-resource-table.utils';

describe('apk resource table utilities', () => {
  it('scores strong launcher paths above weaker candidates', () => {
    expect(
      scoreResourceIconPath('res/mipmap-xxhdpi/ic_launcher.png', 480),
    ).toBeGreaterThan(
      scoreResourceIconPath('res/drawable/monochrome_icon.png', 480),
    );
  });

  it('reads chunk header sizes and resource maps from binary xml chunks', () => {
    const chunk = Buffer.alloc(16);
    chunk.writeUInt16LE(8, 2);
    chunk.writeUInt32LE(16, 4);
    chunk.writeUInt32LE(0x01020304, 8);
    chunk.writeUInt32LE(0x05060708, 12);

    expect(readChunkHeaderSize(chunk, 0)).toBe(8);
    expect(readChunkHeaderSize(Buffer.alloc(2), 0)).toBe(8);
    expect(readBinaryXmlResourceMap(chunk, 0, 16)).toEqual([
      0x01020304, 0x05060708,
    ]);
  });

  it('reads encoded utf8 and utf16 string lengths and values', () => {
    expect(readLength8(Buffer.from([0x81, 0x2c]), 0)).toEqual({
      length: 300,
      nextOffset: 2,
    });

    const length16 = Buffer.alloc(4);
    length16.writeUInt16LE(0x8001, 0);
    length16.writeUInt16LE(0x0002, 2);
    expect(readLength16(length16, 0)).toEqual({
      length: 65538,
      nextOffset: 4,
    });

    expect(readUtf8String(Buffer.from([4, 4, 105, 99, 111, 110, 0]), 0)).toBe(
      'icon',
    );

    const utf16 = Buffer.alloc(10);
    utf16.writeUInt16LE(4, 0);
    utf16.write('icon', 2, 'utf16le');
    expect(readUtf16String(utf16, 0)).toBe('icon');
  });

  it('reads a minimal utf8 string pool chunk', () => {
    const buffer = Buffer.alloc(39);
    buffer.writeUInt16LE(0x0001, 0);
    buffer.writeUInt16LE(28, 2);
    buffer.writeUInt32LE(39, 4);
    buffer.writeUInt32LE(1, 8);
    buffer.writeUInt32LE(0, 12);
    buffer.writeUInt32LE(0x00000100, 16);
    buffer.writeUInt32LE(32, 20);
    buffer.writeUInt32LE(0, 24);
    buffer.writeUInt32LE(0, 28);
    buffer.set(Buffer.from([4, 4, 105, 99, 111, 110, 0]), 32);

    expect(readBinaryXmlStringPool(buffer, 0)).toEqual({
      strings: ['icon'],
    });
  });

  it('bounds malformed chunks, attributes, and string offsets', () => {
    const oversizedChunk = Buffer.alloc(12);
    oversizedChunk.writeUInt16LE(8, 2);
    oversizedChunk.writeUInt32LE(128, 4);
    expect([...readBinaryResourceChunks(oversizedChunk, 0)]).toEqual([]);

    const malformedElement = Buffer.alloc(36);
    malformedElement.writeUInt16LE(36, 2);
    malformedElement.writeUInt32LE(36, 4);
    malformedElement.writeUInt16LE(4, 26);
    malformedElement.writeUInt16LE(0xffff, 28);
    const [chunk] = [...readBinaryResourceChunks(malformedElement, 0)];
    expect(chunk).toBeDefined();
    expect([...readBinaryXmlAttributes(malformedElement, chunk!)]).toEqual([]);

    const malformedPool = Buffer.alloc(32);
    malformedPool.writeUInt16LE(0x0001, 0);
    malformedPool.writeUInt16LE(28, 2);
    malformedPool.writeUInt32LE(32, 4);
    malformedPool.writeUInt32LE(0xffffffff, 8);
    malformedPool.writeUInt32LE(0x00000100, 16);
    malformedPool.writeUInt32LE(0xffffffff, 20);
    expect(() => readBinaryXmlStringPool(malformedPool, 0)).not.toThrow();
    expect(readBinaryXmlStringPool(malformedPool, 0)).toEqual({ strings: [] });
    expect(readResourceTableHeader(Buffer.from([0x02]))).toBeNull();
    expect(readUtf8String(Buffer.from([0x80]), 0)).toBe('');
    expect(readUtf16String(Buffer.from([0x00, 0x80]), 0)).toBe('');
    expect([...readSimpleResourceEntries(Buffer.alloc(0), 0, 0)]).toEqual([]);
  });

  it('reads bounded simple resource entries', () => {
    const resources = Buffer.alloc(340);
    resources.writeUInt16LE(284, 2);
    resources.writeUInt32LE(0x7f, 8);
    const chunkOffset = 284;
    resources.writeUInt16LE(0x0201, chunkOffset);
    resources.writeUInt16LE(36, chunkOffset + 2);
    resources.writeUInt32LE(56, chunkOffset + 4);
    resources.writeUInt8(1, chunkOffset + 8);
    resources.writeUInt32LE(1, chunkOffset + 12);
    resources.writeUInt32LE(40, chunkOffset + 16);
    resources.writeUInt16LE(480, chunkOffset + 34);
    resources.writeUInt32LE(0, chunkOffset + 36);
    resources.writeUInt16LE(0, chunkOffset + 42);
    resources.writeUInt8(0x03, chunkOffset + 51);
    resources.writeUInt32LE(2, chunkOffset + 52);

    expect([
      ...readSimpleResourceEntries(resources, 0, resources.length),
    ]).toEqual([
      {
        resourceId: 0x7f010000,
        dataType: 0x03,
        data: 2,
        density: 480,
      },
    ]);
  });
});
