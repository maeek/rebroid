import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { In, IsNull, Not, Repository } from 'typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { SettingsService } from '../settings/settings.service';
import { UploadedApk } from './uploaded-apk.entity';

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface IconCandidate {
  entry: ZipEntry;
  score: number;
  mimeType: string;
}

interface ResourceIconCandidate {
  entryName: string;
  score: number;
  mimeType: string;
}

interface ParsedStringPool {
  strings: string[];
}

const eocdSignature = 0x06054b50;
const centralFileHeaderSignature = 0x02014b50;
const localFileHeaderSignature = 0x04034b50;
const maxIconBytes = 512 * 1024;
const maxCandidatesToRead = 24;
const resStringPoolType = 0x0001;
const resTableType = 0x0002;
const resXmlResourceMapType = 0x0180;
const resXmlStartElementType = 0x0102;
const resTablePackageType = 0x0200;
const resTableTypeType = 0x0201;
const typedValueReference = 0x01;
const typedValueString = 0x03;
const androidIconAttr = 0x01010002;
const androidRoundIconAttr = 0x0101052c;
const noEntry = 0xffffffff;

@Injectable()
export class ApkService {
  private readonly logger = new Logger(ApkService.name);

  constructor(
    @InjectRepository(UploadedApk)
    private readonly uploadedApks: Repository<UploadedApk>,
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  async upload(apk: Express.Multer.File, ownerUserId?: string | null) {
    if (!apk) {
      throw new ConflictException('An APK file is required.');
    }

    await this.settings.assertApkSizeAllowed(apk);

    const sha256 = createHash('sha256').update(apk.buffer).digest('hex');
    const owner = ownerUserId?.trim() || null;
    const existing = await this.uploadedApks.findOneBy({
      sha256,
      ownerUserId: owner ?? IsNull(),
    });
    if (existing) {
      const extractedIconDataUrl = this.extractLauncherIconDataUrl(apk.buffer);
      if (
        extractedIconDataUrl &&
        extractedIconDataUrl !== existing.extractedIconDataUrl
      ) {
        existing.extractedIconDataUrl = extractedIconDataUrl;
        await this.uploadedApks.save(existing);
      }
      return existing;
    }

    const extractedIconDataUrl = this.extractLauncherIconDataUrl(apk.buffer);
    const filePath = await this.persistApk(sha256, apk.buffer);
    const uploaded = this.uploadedApks.create({
      ownerUserId: owner,
      originalName: apk.originalname || `${sha256}.apk`,
      sha256,
      sizeBytes: apk.size,
      filePath,
      extractedIconDataUrl,
    });

    return this.uploadedApks.save(uploaded);
  }

  list(ownerUserId?: string) {
    return this.uploadedApks.find({
      where: ownerUserId ? { ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async get(id: string) {
    const uploaded = await this.uploadedApks.findOneBy({ id });
    if (!uploaded) {
      throw new ConflictException(`Uploaded APK "${id}" was not found.`);
    }

    return uploaded;
  }

  async remove(id: string) {
    const uploaded = await this.get(id);
    const inUseCount = await this.applications.countBy({ uploadedApkId: id });
    if (inUseCount > 0) {
      throw new ConflictException(
        'Uploaded APK is used by one or more Android applications.',
      );
    }

    await this.uploadedApks.remove(uploaded);
    await this.removeSharedFileIfUnused(uploaded);
    return uploaded;
  }

  async cleanupUnused(ownerUserId?: string | null) {
    const owner = ownerUserId?.trim();
    const uploads = await this.uploadedApks.find({
      where: owner ? { ownerUserId: owner } : {},
    });
    const ids = uploads.map((upload) => upload.id);
    if (ids.length === 0) {
      return { deletedRecords: 0, removedFiles: 0 };
    }

    const used = await this.applications.find({
      select: { uploadedApkId: true },
      where: { uploadedApkId: In(ids) },
    });
    const usedIds = new Set(
      used.map((app) => app.uploadedApkId).filter(Boolean),
    );
    const unused = uploads.filter((upload) => !usedIds.has(upload.id));

    let removedFiles = 0;
    for (const upload of unused) {
      await this.uploadedApks.remove(upload);
      if (await this.removeSharedFileIfUnused(upload)) {
        removedFiles += 1;
      }
    }

    return { deletedRecords: unused.length, removedFiles };
  }

  private async persistApk(sha256: string, content: Buffer) {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const apkDir = join(uploadsDir, 'apks');
    await mkdir(apkDir, { recursive: true });
    const filePath = join(apkDir, `${sha256}.apk`);
    await writeFile(filePath, content, { flag: 'wx' }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      },
    );
    return filePath;
  }

  private async removeSharedFileIfUnused(upload: UploadedApk) {
    const remaining = await this.uploadedApks.countBy({
      sha256: upload.sha256,
      id: Not(upload.id),
    });
    if (remaining > 0) {
      return false;
    }

    await unlink(upload.filePath).catch(() => undefined);
    return true;
  }

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

        const dimensions = this.imageDimensions(content, candidate.mimeType);
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
        `Could not extract APK launcher icon: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private toIconCandidate(entry: ZipEntry): IconCandidate | null {
    const path = entry.name.toLowerCase();
    if (!path.startsWith('res/') || entry.uncompressedSize > maxIconBytes) {
      return null;
    }

    const mimeType = this.imageMimeType(path);
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
    const mimeType = this.imageMimeType(normalizedPath.toLowerCase());
    if (!entry || !mimeType || entry.uncompressedSize > maxIconBytes) {
      return null;
    }

    const content = this.readEntry(apk, entry);
    if (!content || content.length === 0 || content.length > maxIconBytes) {
      return null;
    }

    const dimensions = this.imageDimensions(content, mimeType);
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
    let offset = this.readChunkHeaderSize(manifest, 0);

    while (offset + 8 <= manifest.length) {
      const type = manifest.readUInt16LE(offset);
      const size = manifest.readUInt32LE(offset + 4);
      if (size < 8 || offset + size > manifest.length) {
        break;
      }

      if (type === resStringPoolType) {
        strings = this.readStringPool(manifest, offset).strings;
      } else if (type === resXmlResourceMapType) {
        resourceMap = this.readXmlResourceMap(manifest, offset, size);
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

  private readResourceIconCandidates(resources: Buffer, resourceIds: number[]) {
    const targetIds = new Set(resourceIds);
    const candidates: ResourceIconCandidate[] = [];
    if (resources.length < 12 || resources.readUInt16LE(0) !== resTableType) {
      return candidates;
    }

    let offset = this.readChunkHeaderSize(resources, 0);
    const globalStringPool = this.readStringPool(resources, offset);
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
            ? this.imageMimeType(entryName.toLowerCase())
            : null;
          if (!entryName || !mimeType) {
            continue;
          }

          candidates.push({
            entryName,
            mimeType,
            score: this.resourceIconScore(entryName, density),
          });
        }
      }

      offset += size;
    }

    return candidates;
  }

  private resourceIconScore(path: string, density: number) {
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
  }

  private readXmlResourceMap(buffer: Buffer, offset: number, size: number) {
    const resourceMap: number[] = [];
    for (
      let cursor = offset + this.readChunkHeaderSize(buffer, offset);
      cursor + 4 <= offset + size;
      cursor += 4
    ) {
      resourceMap.push(buffer.readUInt32LE(cursor));
    }
    return resourceMap;
  }

  private readStringPool(buffer: Buffer, offset: number): ParsedStringPool {
    if (
      offset + 28 > buffer.length ||
      buffer.readUInt16LE(offset) !== resStringPoolType
    ) {
      return { strings: [] };
    }

    const headerSize = this.readChunkHeaderSize(buffer, offset);
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
          ? this.readUtf8String(buffer, stringOffset)
          : this.readUtf16String(buffer, stringOffset),
      );
    }

    return { strings };
  }

  private readUtf8String(buffer: Buffer, offset: number) {
    const firstLength = this.readLength8(buffer, offset);
    const secondLength = this.readLength8(buffer, firstLength.nextOffset);
    const start = secondLength.nextOffset;
    return buffer.toString('utf-8', start, start + secondLength.length);
  }

  private readUtf16String(buffer: Buffer, offset: number) {
    const length = this.readLength16(buffer, offset);
    const start = length.nextOffset;
    return buffer.toString('utf16le', start, start + length.length * 2);
  }

  private readLength8(buffer: Buffer, offset: number) {
    const first = buffer.readUInt8(offset);
    if ((first & 0x80) === 0) {
      return { length: first, nextOffset: offset + 1 };
    }

    return {
      length: ((first & 0x7f) << 8) | buffer.readUInt8(offset + 1),
      nextOffset: offset + 2,
    };
  }

  private readLength16(buffer: Buffer, offset: number) {
    const first = buffer.readUInt16LE(offset);
    if ((first & 0x8000) === 0) {
      return { length: first, nextOffset: offset + 2 };
    }

    return {
      length: ((first & 0x7fff) << 16) | buffer.readUInt16LE(offset + 2),
      nextOffset: offset + 4,
    };
  }

  private readChunkHeaderSize(buffer: Buffer, offset: number) {
    return offset + 4 <= buffer.length ? buffer.readUInt16LE(offset + 2) : 8;
  }

  private imageMimeType(path: string) {
    if (path.endsWith('.png')) return 'image/png';
    if (path.endsWith('.webp')) return 'image/webp';
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
    return null;
  }

  private imageDimensions(content: Buffer, mimeType: string) {
    if (
      mimeType === 'image/png' &&
      content.length >= 24 &&
      content[0] === 0x89 &&
      content.toString('ascii', 1, 4) === 'PNG'
    ) {
      return {
        width: content.readUInt32BE(16),
        height: content.readUInt32BE(20),
      };
    }

    if (
      mimeType === 'image/webp' &&
      content.length >= 30 &&
      content.toString('ascii', 0, 4) === 'RIFF'
    ) {
      const chunkType = content.toString('ascii', 12, 16);
      if (chunkType === 'VP8X' && content.length >= 30) {
        return {
          width: 1 + content.readUIntLE(24, 3),
          height: 1 + content.readUIntLE(27, 3),
        };
      }
      if (chunkType === 'VP8 ' && content.length >= 30) {
        return {
          width: content.readUInt16LE(26) & 0x3fff,
          height: content.readUInt16LE(28) & 0x3fff,
        };
      }
      if (chunkType === 'VP8L' && content.length >= 25) {
        const bits = content.readUInt32LE(21);
        return {
          width: 1 + (bits & 0x3fff),
          height: 1 + ((bits >> 14) & 0x3fff),
        };
      }
    }

    return null;
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
