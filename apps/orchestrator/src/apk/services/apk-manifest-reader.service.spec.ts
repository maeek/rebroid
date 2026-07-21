import {
  noEntry,
  resStringPoolType,
  resXmlStartElementType,
  typedValueReference,
  typedValueString,
} from '../types/apk.types';
import { ApkManifestReaderService } from './apk-manifest-reader.service';

const stringPool = (strings: string[]) => {
  const encoded = strings.map((value) => {
    const content = Buffer.from(value, 'utf8');
    return Buffer.concat([
      Buffer.from([content.length, content.length]),
      content,
      Buffer.from([0]),
    ]);
  });
  const headerSize = 28;
  const offsetsSize = strings.length * 4;
  const chunkSize =
    headerSize +
    offsetsSize +
    encoded.reduce((size, value) => size + value.length, 0);
  const chunk = Buffer.alloc(chunkSize);
  chunk.writeUInt16LE(resStringPoolType, 0);
  chunk.writeUInt16LE(headerSize, 2);
  chunk.writeUInt32LE(chunkSize, 4);
  chunk.writeUInt32LE(strings.length, 8);
  chunk.writeUInt32LE(0x00000100, 16);
  chunk.writeUInt32LE(headerSize + offsetsSize, 20);
  let valueOffset = 0;
  encoded.forEach((value, index) => {
    chunk.writeUInt32LE(valueOffset, headerSize + index * 4);
    value.copy(chunk, headerSize + offsetsSize + valueOffset);
    valueOffset += value.length;
  });
  return chunk;
};

const startElement = (
  nameIndex: number,
  attributes: Array<{
    nameIndex: number;
    rawValueIndex: number;
    dataType: number;
    data: number;
  }>,
) => {
  const attributesStart = 36;
  const chunk = Buffer.alloc(attributesStart + attributes.length * 20);
  chunk.writeUInt16LE(resXmlStartElementType, 0);
  chunk.writeUInt16LE(16, 2);
  chunk.writeUInt32LE(chunk.length, 4);
  chunk.writeUInt32LE(nameIndex, 20);
  chunk.writeUInt16LE(20, 24);
  chunk.writeUInt16LE(20, 26);
  chunk.writeUInt16LE(attributes.length, 28);
  attributes.forEach((attribute, index) => {
    const offset = attributesStart + index * 20;
    chunk.writeUInt32LE(noEntry, offset);
    chunk.writeUInt32LE(attribute.nameIndex, offset + 4);
    chunk.writeUInt32LE(attribute.rawValueIndex, offset + 8);
    chunk.writeUInt16LE(8, offset + 12);
    chunk.writeUInt8(attribute.dataType, offset + 15);
    chunk.writeUInt32LE(attribute.data, offset + 16);
  });
  return chunk;
};

describe('ApkManifestReaderService', () => {
  const reader = new ApkManifestReaderService();

  it('reads package, application label, and icon metadata', () => {
    const strings = [
      'manifest',
      'package',
      'com.example.app',
      'application',
      'label',
      'Example App',
      'icon',
    ];
    const pool = stringPool(strings);
    const manifestElement = startElement(0, [
      {
        nameIndex: 1,
        rawValueIndex: 2,
        dataType: typedValueString,
        data: 2,
      },
    ]);
    const applicationElement = startElement(3, [
      {
        nameIndex: 4,
        rawValueIndex: 5,
        dataType: typedValueString,
        data: 5,
      },
      {
        nameIndex: 6,
        rawValueIndex: noEntry,
        dataType: typedValueReference,
        data: 0x7f080001,
      },
    ]);
    const header = Buffer.alloc(8);
    const size =
      header.length +
      pool.length +
      manifestElement.length +
      applicationElement.length;
    header.writeUInt16LE(0x0003, 0);
    header.writeUInt16LE(8, 2);
    header.writeUInt32LE(size, 4);
    const manifest = Buffer.concat([
      header,
      pool,
      manifestElement,
      applicationElement,
    ]);

    expect(reader.readPackageName(manifest)).toBe('com.example.app');
    expect(reader.readApplicationLabel(manifest)).toEqual({
      value: 'Example App',
    });
    expect(reader.readIconReferences(manifest)).toEqual({
      iconResourceId: 0x7f080001,
    });
  });

  it.each([
    Buffer.alloc(0),
    Buffer.alloc(7),
    Buffer.from([0x03, 0x00, 0x08, 0x00, 0xff, 0xff, 0xff, 0xff]),
  ])('fails closed for truncated or adversarial manifests', (manifest) => {
    expect(() => reader.readStrings(manifest)).not.toThrow();
    expect(reader.readPackageName(manifest)).toBeNull();
    expect(reader.readApplicationLabel(manifest)).toEqual({});
    expect(reader.readIconReferences(manifest)).toEqual({});
  });
});
