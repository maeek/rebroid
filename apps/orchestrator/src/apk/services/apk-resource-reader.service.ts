import { Injectable } from '@nestjs/common';
import {
  noEntry,
  ParsedStringPool,
  ResourceIconCandidate,
  resTablePackageType,
  resTableType,
  resTableTypeType,
  typedValueString,
} from '../types/apk.types';
import { imageMimeType } from '../utils/apk-image.utils';
import {
  readBinaryXmlStringPool,
  readChunkHeaderSize,
  scoreResourceIconPath,
} from '../utils/apk-resource-table.utils';

@Injectable()
export class ApkResourceReaderService {
  readString(resources: Buffer, resourceId: number) {
    if (resources.length < 12 || resources.readUInt16LE(0) !== resTableType) {
      return null;
    }

    let offset = readChunkHeaderSize(resources, 0);
    const globalStringPool = readBinaryXmlStringPool(resources, offset);
    offset += resources.readUInt32LE(offset + 4);

    while (offset + 8 <= resources.length) {
      const type = resources.readUInt16LE(offset);
      const size = resources.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > resources.length) {
        break;
      }

      if (type === resTablePackageType) {
        const value = this.readPackageStringResource(
          resources,
          offset,
          size,
          globalStringPool,
          resourceId,
        );
        if (value) {
          return value;
        }
      }

      offset += size;
    }

    return null;
  }

  readIconCandidates(resources: Buffer, resourceIds: number[]) {
    const targetIds = new Set(resourceIds);
    const candidates: ResourceIconCandidate[] = [];
    if (resources.length < 12 || resources.readUInt16LE(0) !== resTableType) {
      return candidates;
    }

    let offset = readChunkHeaderSize(resources, 0);
    const globalStringPool = readBinaryXmlStringPool(resources, offset);
    offset += resources.readUInt32LE(offset + 4);

    while (offset + 8 <= resources.length) {
      const type = resources.readUInt16LE(offset);
      const size = resources.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > resources.length) {
        break;
      }

      if (type === resTablePackageType) {
        candidates.push(
          ...this.readPackageIconCandidates(
            resources,
            offset,
            size,
            globalStringPool,
            targetIds,
          ),
        );
      }

      offset += size;
    }

    return candidates;
  }

  private readPackageStringResource(
    resources: Buffer,
    packageOffset: number,
    packageSize: number,
    globalStringPool: ParsedStringPool,
    targetResourceId: number,
  ) {
    if (packageOffset + 284 > resources.length) {
      return null;
    }

    const packageId = resources.readUInt32LE(packageOffset + 8);
    const packageEnd = packageOffset + packageSize;
    let offset = packageOffset + resources.readUInt16LE(packageOffset + 2);

    while (offset + 8 <= packageEnd) {
      const type = resources.readUInt16LE(offset);
      const headerSize = resources.readUInt16LE(offset + 2);
      const size = resources.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > packageEnd) {
        break;
      }

      if (type === resTableTypeType && headerSize >= 20) {
        const typeId = resources.readUInt8(offset + 8);
        const entryCount = resources.readUInt32LE(offset + 12);
        const entriesStart = resources.readUInt32LE(offset + 16);
        const entriesOffset = offset + headerSize;

        for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
          const resourceId =
            packageId * 0x01000000 + typeId * 0x00010000 + entryIndex;
          if (resourceId !== targetResourceId) {
            continue;
          }

          const entryOffsetPosition = entriesOffset + entryIndex * 4;
          if (entryOffsetPosition + 4 > offset + size) {
            break;
          }

          const entryOffset = resources.readUInt32LE(entryOffsetPosition);
          if (entryOffset === noEntry) {
            continue;
          }

          const valueOffset = offset + entriesStart + entryOffset;
          if (valueOffset + 16 > offset + size) {
            continue;
          }

          const flags = resources.readUInt16LE(valueOffset + 2);
          if ((flags & 0x0001) !== 0) {
            continue;
          }

          const dataType = resources.readUInt8(valueOffset + 11);
          const data = resources.readUInt32LE(valueOffset + 12);
          if (dataType !== typedValueString) {
            continue;
          }

          return globalStringPool.strings[data] ?? null;
        }
      }

      offset += size;
    }

    return null;
  }

  private readPackageIconCandidates(
    resources: Buffer,
    packageOffset: number,
    packageSize: number,
    globalStringPool: ParsedStringPool,
    targetIds: Set<number>,
  ) {
    const candidates: ResourceIconCandidate[] = [];
    if (packageOffset + 284 > resources.length) {
      return candidates;
    }

    const packageId = resources.readUInt32LE(packageOffset + 8);
    const packageEnd = packageOffset + packageSize;
    let offset = packageOffset + resources.readUInt16LE(packageOffset + 2);

    while (offset + 8 <= packageEnd) {
      const type = resources.readUInt16LE(offset);
      const headerSize = resources.readUInt16LE(offset + 2);
      const size = resources.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > packageEnd) {
        break;
      }

      if (type === resTableTypeType && headerSize >= 20) {
        const typeId = resources.readUInt8(offset + 8);
        const entryCount = resources.readUInt32LE(offset + 12);
        const entriesStart = resources.readUInt32LE(offset + 16);
        const density =
          offset + 36 <= resources.length
            ? resources.readUInt16LE(offset + 34)
            : 0;
        const entriesOffset = offset + headerSize;

        for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
          const entryOffsetPosition = entriesOffset + entryIndex * 4;
          if (entryOffsetPosition + 4 > offset + size) {
            break;
          }

          const entryOffset = resources.readUInt32LE(entryOffsetPosition);
          if (entryOffset === noEntry) {
            continue;
          }

          const resourceId =
            packageId * 0x01000000 + typeId * 0x00010000 + entryIndex;
          if (!targetIds.has(resourceId)) {
            continue;
          }

          const valueOffset = offset + entriesStart + entryOffset;
          if (valueOffset + 16 > offset + size) {
            continue;
          }

          const flags = resources.readUInt16LE(valueOffset + 2);
          if ((flags & 0x0001) !== 0) {
            continue;
          }

          const dataType = resources.readUInt8(valueOffset + 11);
          const data = resources.readUInt32LE(valueOffset + 12);
          if (dataType !== typedValueString) {
            continue;
          }

          const entryName = globalStringPool.strings[data];
          const mimeType = entryName
            ? imageMimeType(entryName.toLowerCase())
            : null;
          if (!entryName || !mimeType) {
            continue;
          }

          candidates.push({
            entryName,
            mimeType,
            score: scoreResourceIconPath(entryName, density),
          });
        }
      }

      offset += size;
    }

    return candidates;
  }
}
