import { Injectable } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import {
  centralFileHeaderSignature,
  eocdSignature,
  localFileHeaderSignature,
  ZipEntry,
} from '../types/apk.types';

@Injectable()
export class ApkZipReaderService {
  readCentralDirectory(apk: Buffer): ZipEntry[] {
    const eocdOffset = this.findEndOfCentralDirectory(apk);
    if (eocdOffset === -1) {
      return [];
    }

    const totalEntries = apk.readUInt16LE(eocdOffset + 10);
    let offset = apk.readUInt32LE(eocdOffset + 16);
    const entries: ZipEntry[] = [];

    for (
      let index = 0;
      index < totalEntries && offset < apk.length;
      index += 1
    ) {
      if (apk.readUInt32LE(offset) !== centralFileHeaderSignature) {
        break;
      }

      const compressionMethod = apk.readUInt16LE(offset + 10);
      const compressedSize = apk.readUInt32LE(offset + 20);
      const uncompressedSize = apk.readUInt32LE(offset + 24);
      const fileNameLength = apk.readUInt16LE(offset + 28);
      const extraLength = apk.readUInt16LE(offset + 30);
      const commentLength = apk.readUInt16LE(offset + 32);
      const localHeaderOffset = apk.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const nameEnd = nameStart + fileNameLength;
      const name = apk.toString('utf-8', nameStart, nameEnd);

      if (!name.endsWith('/')) {
        entries.push({
          name,
          compressionMethod,
          compressedSize,
          uncompressedSize,
          localHeaderOffset,
        });
      }

      offset = nameEnd + extraLength + commentLength;
    }

    return entries;
  }

  readEntry(apk: Buffer, entry: ZipEntry) {
    const offset = entry.localHeaderOffset;
    if (
      offset < 0 ||
      offset + 30 > apk.length ||
      apk.readUInt32LE(offset) !== localFileHeaderSignature
    ) {
      return null;
    }

    const fileNameLength = apk.readUInt16LE(offset + 26);
    const extraLength = apk.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > apk.length) {
      return null;
    }

    const compressed = apk.subarray(dataStart, dataEnd);
    if (entry.compressionMethod === 0) {
      return Buffer.from(compressed);
    }
    if (entry.compressionMethod === 8) {
      return inflateRawSync(compressed);
    }

    return null;
  }

  private findEndOfCentralDirectory(apk: Buffer) {
    const minimumOffset = Math.max(0, apk.length - 65_557);
    for (let offset = apk.length - 22; offset >= minimumOffset; offset -= 1) {
      if (apk.readUInt32LE(offset) === eocdSignature) {
        return offset;
      }
    }

    return -1;
  }
}
