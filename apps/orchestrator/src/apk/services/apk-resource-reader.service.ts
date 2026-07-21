import { Injectable } from '@nestjs/common';
import {
  ParsedStringPool,
  ResourceIconCandidate,
  resTablePackageType,
  typedValueString,
} from '../types/apk.types';
import { imageMimeType } from '../utils/apk-image.utils';
import {
  readBinaryResourceChunks,
  readResourceTableHeader,
  readSimpleResourceEntries,
  scoreResourceIconPath,
} from '../utils/apk-resource-table.utils';

@Injectable()
export class ApkResourceReaderService {
  readString(resources: Buffer, resourceId: number) {
    const header = readResourceTableHeader(resources);
    if (!header) return null;

    for (const chunk of readBinaryResourceChunks(
      resources,
      header.packagesOffset,
    )) {
      if (chunk.type === resTablePackageType) {
        const value = this.readPackageStringResource(
          resources,
          chunk.offset,
          chunk.size,
          header.stringPool,
          resourceId,
        );
        if (value) {
          return value;
        }
      }
    }

    return null;
  }

  readIconCandidates(resources: Buffer, resourceIds: number[]) {
    const targetIds = new Set(resourceIds);
    const candidates: ResourceIconCandidate[] = [];
    const header = readResourceTableHeader(resources);
    if (!header) return candidates;

    for (const chunk of readBinaryResourceChunks(
      resources,
      header.packagesOffset,
    )) {
      if (chunk.type === resTablePackageType) {
        candidates.push(
          ...this.readPackageIconCandidates(
            resources,
            chunk.offset,
            chunk.size,
            header.stringPool,
            targetIds,
          ),
        );
      }
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
    for (const entry of readSimpleResourceEntries(
      resources,
      packageOffset,
      packageSize,
    )) {
      if (
        entry.resourceId === targetResourceId &&
        entry.dataType === typedValueString
      ) {
        return globalStringPool.strings[entry.data] ?? null;
      }
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
    for (const entry of readSimpleResourceEntries(
      resources,
      packageOffset,
      packageSize,
    )) {
      if (
        !targetIds.has(entry.resourceId) ||
        entry.dataType !== typedValueString
      ) {
        continue;
      }
      const entryName = globalStringPool.strings[entry.data];
      const mimeType = entryName
        ? imageMimeType(entryName.toLowerCase())
        : null;
      if (!entryName || !mimeType) continue;

      candidates.push({
        entryName,
        mimeType,
        score: scoreResourceIconPath(entryName, entry.density),
      });
    }

    return candidates;
  }
}
