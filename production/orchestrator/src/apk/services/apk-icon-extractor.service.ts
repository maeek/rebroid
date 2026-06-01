import { Injectable, Logger } from '@nestjs/common';
import { inflateRawSync } from 'node:zlib';
import { getErrorMessage } from '../../common/error-message';
import {
  androidIconAttr,
  androidLabelAttr,
  androidRoundIconAttr,
  centralFileHeaderSignature,
  eocdSignature,
  IconCandidate,
  localFileHeaderSignature,
  maxCandidatesToRead,
  maxIconBytes,
  noEntry,
  ParsedStringPool,
  ResourceIconCandidate,
  resStringPoolType,
  resTablePackageType,
  resTableType,
  resTableTypeType,
  resXmlResourceMapType,
  resXmlStartElementType,
  typedValueReference,
  typedValueString,
  ZipEntry,
} from '../types/apk.types';
import { imageDimensions, imageMimeType } from '../utils/apk-image.utils';
import {
  readBinaryXmlResourceMap,
  readBinaryXmlStringPool,
  readChunkHeaderSize,
  scoreResourceIconPath,
} from '../utils/apk-resource-table.utils';
import { ApkArchiveService } from './apk-archive.service';

@Injectable()
export class ApkIconExtractorService {
  private readonly logger = new Logger(ApkIconExtractorService.name);
  private readonly maxMetadataEntryBytes = 64 * 1024 * 1024;

  constructor(private readonly archive: ApkArchiveService) {}

  async extractMetadataFromFile(filePath: string) {
    try {
      const entries = await this.archive.listEntries(filePath);
      const entriesByName = new Map(
        entries.map((entry) => [entry.name, entry]),
      );
      const manifest = await this.archive.readEntry(
        filePath,
        'AndroidManifest.xml',
        this.maxMetadataEntryBytes,
      );
      if (!manifest) {
        return {
          extractedIconDataUrl: null,
          displayName: null,
          packageName: null,
        };
      }

      const packageName = this.readManifestPackageName(manifest);
      const label = this.readManifestApplicationLabel(manifest);
      const declaredIcons = this.readManifestIconReferences(manifest);
      let resources: Buffer | null | undefined;
      const getResources = async () => {
        if (resources === undefined) {
          resources = entriesByName.has('resources.arsc')
            ? await this.archive.readEntry(
                filePath,
                'resources.arsc',
                this.maxMetadataEntryBytes,
              )
            : null;
        }
        return resources;
      };

      let displayName = label.value
        ? this.normalizeDisplayName(label.value)
        : null;
      if (!displayName && typeof label.resourceId === 'number') {
        const content = await getResources();
        const resolved = content
          ? this.readResourceString(content, label.resourceId)
          : null;
        displayName = resolved ? this.normalizeDisplayName(resolved) : null;
      }

      let extractedIconDataUrl: string | null = null;
      const directPaths = [
        declaredIcons.iconPath,
        declaredIcons.roundIconPath,
      ].filter((value): value is string => Boolean(value));
      for (const path of directPaths) {
        extractedIconDataUrl = await this.readIconPathFromArchive(
          filePath,
          entriesByName,
          path,
          10_000,
        );
        if (extractedIconDataUrl) {
          break;
        }
      }

      const resourceIds = [
        declaredIcons.iconResourceId,
        declaredIcons.roundIconResourceId,
      ].filter((value): value is number => typeof value === 'number');
      if (!extractedIconDataUrl && resourceIds.length > 0) {
        const content = await getResources();
        const candidates = content
          ? this.readResourceIconCandidates(content, resourceIds).sort(
              (left, right) => right.score - left.score,
            )
          : [];
        for (const candidate of candidates) {
          extractedIconDataUrl = await this.readIconPathFromArchive(
            filePath,
            entriesByName,
            candidate.entryName,
            candidate.score,
          );
          if (extractedIconDataUrl) {
            break;
          }
        }
      }

      if (!extractedIconDataUrl) {
        const candidates = entries
          .map((entry) => this.toIconCandidate(entry))
          .filter((candidate): candidate is IconCandidate => Boolean(candidate))
          .sort((left, right) => right.score - left.score)
          .slice(0, maxCandidatesToRead);
        let best: { score: number; mimeType: string; content: Buffer } | null =
          null;
        for (const candidate of candidates) {
          const content = await this.archive.readEntry(
            filePath,
            candidate.entry.name,
            maxIconBytes,
          );
          if (!content || content.length === 0) {
            continue;
          }
          const dimensions = imageDimensions(content, candidate.mimeType);
          const score =
            candidate.score +
            (dimensions
              ? Math.min(Math.max(dimensions.width, dimensions.height), 512)
              : 0);
          if (!best || score > best.score) {
            best = { score, mimeType: candidate.mimeType, content };
          }
        }
        extractedIconDataUrl = best
          ? `data:${best.mimeType};base64,${best.content.toString('base64')}`
          : null;
      }

      return { extractedIconDataUrl, displayName, packageName };
    } catch (error) {
      this.logger.warn(
        `Could not extract APK metadata: ${getErrorMessage(error, 'unknown error')}`,
      );
      return {
        extractedIconDataUrl: null,
        displayName: null,
        packageName: null,
      };
    }
  }

  /** Reads the manifest package name from an APK, best-effort. */
  extractPackageName(apk: Buffer) {
    try {
      const entries = this.readCentralDirectory(apk);
      const manifestEntry = entries.find(
        (entry) => entry.name === 'AndroidManifest.xml',
      );
      if (!manifestEntry) {
        return null;
      }

      const manifest = this.readEntry(apk, manifestEntry);
      return manifest ? this.readManifestPackageName(manifest) : null;
    } catch (error) {
      this.logger.warn(
        `Could not extract APK package name: ${getErrorMessage(error, 'unknown error')}`,
      );
      return null;
    }
  }

  /** Reads the best user-facing application label from an APK, best-effort. */
  extractDisplayName(apk: Buffer) {
    try {
      const entries = this.readCentralDirectory(apk);
      const entriesByName = new Map(
        entries.map((entry) => [entry.name, entry]),
      );
      const manifestEntry = entriesByName.get('AndroidManifest.xml');
      if (!manifestEntry) {
        return null;
      }

      const manifest = this.readEntry(apk, manifestEntry);
      if (!manifest) {
        return null;
      }

      const label = this.readManifestApplicationLabel(manifest);
      if (label.value) {
        return this.normalizeDisplayName(label.value);
      }

      if (typeof label.resourceId !== 'number') {
        return null;
      }

      const resourcesEntry = entriesByName.get('resources.arsc');
      const resources = resourcesEntry
        ? this.readEntry(apk, resourcesEntry)
        : null;
      const resolvedLabel = resources
        ? this.readResourceString(resources, label.resourceId)
        : null;

      return resolvedLabel ? this.normalizeDisplayName(resolvedLabel) : null;
    } catch (error) {
      this.logger.warn(
        `Could not extract APK display name: ${getErrorMessage(error, 'unknown error')}`,
      );
      return null;
    }
  }

  /**
   * Extracts the best launcher icon candidate from an APK and returns it as a data URL.
   * Parsing is best-effort and falls back to heuristic ZIP scanning.
   */
  extractLauncherIconDataUrl(apk: Buffer) {
    try {
      const entries = this.readCentralDirectory(apk);
      const entriesByName = new Map(
        entries.map((entry) => [entry.name, entry]),
      );
      const manifestIcon = this.extractDeclaredLauncherIcon(apk, entriesByName);
      if (manifestIcon) {
        return manifestIcon;
      }

      const candidates = entries
        .map((entry) => this.toIconCandidate(entry))
        .filter((candidate): candidate is IconCandidate => Boolean(candidate))
        .sort((left, right) => right.score - left.score)
        .slice(0, maxCandidatesToRead);

      let best: { score: number; mimeType: string; content: Buffer } | null =
        null;
      for (const candidate of candidates) {
        const content = this.readEntry(apk, candidate.entry);
        if (!content || content.length === 0 || content.length > maxIconBytes) {
          continue;
        }

        const dimensions = imageDimensions(content, candidate.mimeType);
        const dimensionScore = dimensions
          ? Math.min(Math.max(dimensions.width, dimensions.height), 512)
          : 0;
        const score = candidate.score + dimensionScore;
        if (!best || score > best.score) {
          best = { score, mimeType: candidate.mimeType, content };
        }
      }

      return best
        ? `data:${best.mimeType};base64,${best.content.toString('base64')}`
        : null;
    } catch (error) {
      this.logger.warn(
        `Could not extract APK launcher icon: ${getErrorMessage(error, 'unknown error')}`,
      );
      return null;
    }
  }

  private async readIconPathFromArchive(
    filePath: string,
    entriesByName: Map<string, ZipEntry>,
    path: string,
    score: number,
  ) {
    const normalizedPath = path.replace(/^\/+/, '');
    const entry = entriesByName.get(normalizedPath);
    const mimeType = imageMimeType(normalizedPath.toLowerCase());
    if (!entry || !mimeType || entry.uncompressedSize > maxIconBytes) {
      return null;
    }

    const content = await this.archive.readEntry(
      filePath,
      normalizedPath,
      maxIconBytes,
    );
    if (!content || content.length === 0) {
      return null;
    }

    const dimensions = imageDimensions(content, mimeType);
    if (
      score < 10_000 &&
      dimensions &&
      (dimensions.width < 24 || dimensions.height < 24)
    ) {
      return null;
    }

    return `data:${mimeType};base64,${content.toString('base64')}`;
  }

  private toIconCandidate(entry: ZipEntry): IconCandidate | null {
    const path = entry.name.toLowerCase();
    if (!path.startsWith('res/') || entry.uncompressedSize > maxIconBytes) {
      return null;
    }

    const mimeType = imageMimeType(path);
    if (!mimeType) {
      return null;
    }

    let score = 0;
    if (path.startsWith('res/mipmap')) score += 1000;
    if (path.startsWith('res/drawable')) score += 700;
    if (path.includes('ic_launcher')) score += 600;
    if (path.includes('launcher')) score += 350;
    if (path.includes('app_icon')) score += 180;
    if (path.includes('icon')) score += 80;
    if (path.includes('xxxhdpi')) score += 180;
    if (path.includes('xxhdpi')) score += 150;
    if (path.includes('xhdpi')) score += 120;
    if (path.includes('hdpi')) score += 90;
    if (path.includes('mdpi')) score += 50;
    if (path.includes('nodpi')) score += 30;
    if (path.includes('round')) score += 25;
    if (path.includes('foreground')) score -= 450;
    if (path.includes('background')) score -= 450;
    if (path.includes('monochrome')) score -= 700;
    if (!path.includes('launcher') && !path.includes('app_icon')) score -= 650;
    score += Math.min(entry.uncompressedSize / 1024, 128);

    return score > 0 ? { entry, score, mimeType } : null;
  }

  /**
   * Prefers manifest-declared icon paths before falling back to generic resource scoring.
   */
  private extractDeclaredLauncherIcon(
    apk: Buffer,
    entriesByName: Map<string, ZipEntry>,
  ) {
    const manifestEntry = entriesByName.get('AndroidManifest.xml');
    const resourcesEntry = entriesByName.get('resources.arsc');
    if (!manifestEntry || !resourcesEntry) {
      return null;
    }

    const manifest = this.readEntry(apk, manifestEntry);
    const resources = this.readEntry(apk, resourcesEntry);
    if (!manifest || !resources) {
      return null;
    }

    const declaredIcons = this.readManifestIconReferences(manifest);
    const resourceIds = [
      declaredIcons.iconResourceId,
      declaredIcons.roundIconResourceId,
    ].filter((value): value is number => typeof value === 'number');
    const directPaths = [
      declaredIcons.iconPath,
      declaredIcons.roundIconPath,
    ].filter((value): value is string => Boolean(value));

    for (const path of directPaths) {
      const directIcon = this.readIconPath(apk, entriesByName, path, 10_000);
      if (directIcon) {
        return directIcon;
      }
    }

    if (resourceIds.length === 0) {
      return null;
    }

    const resourceIconCandidates = this.readResourceIconCandidates(
      resources,
      resourceIds,
    );
    const sortedCandidates = resourceIconCandidates.sort(
      (left, right) => right.score - left.score,
    );
    for (const candidate of sortedCandidates) {
      const dataUrl = this.readIconPath(
        apk,
        entriesByName,
        candidate.entryName,
        candidate.score,
      );
      if (dataUrl) {
        return dataUrl;
      }
    }

    return null;
  }

  private readIconPath(
    apk: Buffer,
    entriesByName: Map<string, ZipEntry>,
    path: string,
    score: number,
  ) {
    const normalizedPath = path.replace(/^\/+/, '');
    const entry = entriesByName.get(normalizedPath);
    const mimeType = imageMimeType(normalizedPath.toLowerCase());
    if (!entry || !mimeType || entry.uncompressedSize > maxIconBytes) {
      return null;
    }

    const content = this.readEntry(apk, entry);
    if (!content || content.length === 0 || content.length > maxIconBytes) {
      return null;
    }

    const dimensions = imageDimensions(content, mimeType);
    if (
      score < 10_000 &&
      dimensions &&
      (dimensions.width < 24 || dimensions.height < 24)
    ) {
      return null;
    }

    return `data:${mimeType};base64,${content.toString('base64')}`;
  }

  private readManifestIconReferences(manifest: Buffer) {
    const result: {
      iconResourceId?: number;
      roundIconResourceId?: number;
      iconPath?: string;
      roundIconPath?: string;
    } = {};
    let strings: string[] = [];
    let resourceMap: number[] = [];
    let offset = readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = readBinaryXmlStringPool(manifest, offset).strings;
      } else if (type === resXmlResourceMapType) {
        resourceMap = readBinaryXmlResourceMap(manifest, offset, size);
      } else if (type === resXmlStartElementType && size >= 36) {
        const elementNameIndex = manifest.readUInt32LE(offset + 20);
        if (strings[elementNameIndex] === 'application') {
          const attrsStart = offset + 16 + manifest.readUInt16LE(offset + 24);
          const attrSize = manifest.readUInt16LE(offset + 26);
          const attrCount = manifest.readUInt16LE(offset + 28);
          for (let index = 0; index < attrCount; index += 1) {
            const attrOffset = attrsStart + index * attrSize;
            if (attrOffset + 20 > offset + size) {
              continue;
            }

            const nameIndex = manifest.readUInt32LE(attrOffset + 4);
            const rawValueIndex = manifest.readUInt32LE(attrOffset + 8);
            const dataType = manifest.readUInt8(attrOffset + 15);
            const data = manifest.readUInt32LE(attrOffset + 16);
            const name = strings[nameIndex];
            const resourceId = resourceMap[nameIndex];
            const isIcon = name === 'icon' || resourceId === androidIconAttr;
            const isRoundIcon =
              name === 'roundIcon' || resourceId === androidRoundIconAttr;
            if (!isIcon && !isRoundIcon) {
              continue;
            }

            const rawValue =
              rawValueIndex !== noEntry ? strings[rawValueIndex] : undefined;
            if (dataType === typedValueReference) {
              if (isIcon) result.iconResourceId = data;
              if (isRoundIcon) result.roundIconResourceId = data;
            } else if (dataType === typedValueString && rawValue) {
              if (isIcon) result.iconPath = rawValue;
              if (isRoundIcon) result.roundIconPath = rawValue;
            }
          }
        }
      }

      offset += size;
    }

    return result;
  }

  private readManifestPackageName(manifest: Buffer) {
    let strings: string[] = [];
    let offset = readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = readBinaryXmlStringPool(manifest, offset).strings;
      } else if (type === resXmlStartElementType && size >= 36) {
        const elementNameIndex = manifest.readUInt32LE(offset + 20);
        if (strings[elementNameIndex] === 'manifest') {
          const attrsStart = offset + 16 + manifest.readUInt16LE(offset + 24);
          const attrSize = manifest.readUInt16LE(offset + 26);
          const attrCount = manifest.readUInt16LE(offset + 28);
          for (let index = 0; index < attrCount; index += 1) {
            const attrOffset = attrsStart + index * attrSize;
            if (attrOffset + 20 > offset + size) {
              continue;
            }

            const nameIndex = manifest.readUInt32LE(attrOffset + 4);
            const rawValueIndex = manifest.readUInt32LE(attrOffset + 8);
            const dataType = manifest.readUInt8(attrOffset + 15);
            const data = manifest.readUInt32LE(attrOffset + 16);
            if (strings[nameIndex] !== 'package') {
              continue;
            }

            const rawValue =
              rawValueIndex !== noEntry ? strings[rawValueIndex] : undefined;
            const typedValue =
              dataType === typedValueString ? strings[data] : undefined;
            return rawValue || typedValue || null;
          }
        }
      }

      offset += size;
    }

    return null;
  }

  private readManifestApplicationLabel(manifest: Buffer) {
    const result: { value?: string; resourceId?: number } = {};
    let strings: string[] = [];
    let resourceMap: number[] = [];
    let offset = readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = readBinaryXmlStringPool(manifest, offset).strings;
      } else if (type === resXmlResourceMapType) {
        resourceMap = readBinaryXmlResourceMap(manifest, offset, size);
      } else if (type === resXmlStartElementType && size >= 36) {
        const elementNameIndex = manifest.readUInt32LE(offset + 20);
        if (strings[elementNameIndex] === 'application') {
          const attrsStart = offset + 16 + manifest.readUInt16LE(offset + 24);
          const attrSize = manifest.readUInt16LE(offset + 26);
          const attrCount = manifest.readUInt16LE(offset + 28);
          for (let index = 0; index < attrCount; index += 1) {
            const attrOffset = attrsStart + index * attrSize;
            if (attrOffset + 20 > offset + size) {
              continue;
            }

            const nameIndex = manifest.readUInt32LE(attrOffset + 4);
            const rawValueIndex = manifest.readUInt32LE(attrOffset + 8);
            const dataType = manifest.readUInt8(attrOffset + 15);
            const data = manifest.readUInt32LE(attrOffset + 16);
            const name = strings[nameIndex];
            const resourceId = resourceMap[nameIndex];
            if (name !== 'label' && resourceId !== androidLabelAttr) {
              continue;
            }

            const rawValue =
              rawValueIndex !== noEntry ? strings[rawValueIndex] : undefined;
            if (dataType === typedValueReference) {
              result.resourceId = data;
            } else if (dataType === typedValueString) {
              result.value = rawValue || strings[data];
            }
          }
        }
      }

      offset += size;
    }

    return result;
  }

  private readResourceString(resources: Buffer, resourceId: number) {
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

  private normalizeDisplayName(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 0 ? normalized.slice(0, 120) : null;
  }

  private readResourceIconCandidates(resources: Buffer, resourceIds: number[]) {
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
  private readCentralDirectory(apk: Buffer): ZipEntry[] {
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

  private findEndOfCentralDirectory(apk: Buffer) {
    const minimumOffset = Math.max(0, apk.length - 65_557);
    for (let offset = apk.length - 22; offset >= minimumOffset; offset -= 1) {
      if (apk.readUInt32LE(offset) === eocdSignature) {
        return offset;
      }
    }

    return -1;
  }

  private readEntry(apk: Buffer, entry: ZipEntry) {
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
}
