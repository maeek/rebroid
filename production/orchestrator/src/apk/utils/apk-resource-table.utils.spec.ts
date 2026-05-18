import {
  readBinaryXmlResourceMap,
  readBinaryXmlStringPool,
  readChunkHeaderSize,
  readLength16,
  readLength8,
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
      0x01020304,
      0x05060708,
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
});