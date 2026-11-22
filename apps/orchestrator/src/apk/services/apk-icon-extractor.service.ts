import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import type { ApkPackageInspectionPort } from '../contracts/apk-package-inspection.port';
import { maxIconBytes, ZipEntry } from '../types/apk.types';
import {
  imageMimeType,
  launcherIconDataUrl,
  normalizeApkDisplayName,
} from '../utils/apk-image.utils';
import {
  ApkArchiveService,
  type ApkArchiveReader,
} from './apk-archive.service';
import { ApkIconSelectorService } from './apk-icon-selector.service';
import { ApkManifestReaderService } from './apk-manifest-reader.service';
import { readApkResourceMetadata } from '../utils/apk-resource-metadata';

@Injectable()
export class ApkIconExtractorService implements ApkPackageInspectionPort {
  private readonly logger = new Logger(ApkIconExtractorService.name);
  private readonly maxMetadataEntryBytes = 64 * 1024 * 1024;

  constructor(
    private readonly archive: ApkArchiveService,
    private readonly iconSelector: ApkIconSelectorService,
    private readonly manifestReader: ApkManifestReaderService,
  ) {}

  async extractMetadataFromFile(filePath: string) {
    try {
      return await this.archive.withEntries(filePath, (archive) =>
        this.extractMetadata(archive),
      );
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

  async extractPackageNameFromFile(filePath: string) {
    try {
      const manifest = await this.archive.readEntry(
        filePath,
        'AndroidManifest.xml',
        this.maxMetadataEntryBytes,
      );
      return manifest ? this.manifestReader.readPackageName(manifest) : null;
    } catch (error) {
      this.logger.warn(
        `Could not extract APK package name: ${getErrorMessage(error, 'unknown error')}`,
      );
      return null;
    }
  }

  private async extractMetadata(archive: ApkArchiveReader) {
    const { entries } = archive;
    const manifest = await archive.readEntry(
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

    const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
    const { packageName, label, declaredIcons } =
      this.manifestReader.readMetadata(manifest);
    let extractedIconDataUrl: string | null = null;
    const directPaths = [
      declaredIcons.iconPath,
      declaredIcons.roundIconPath,
    ].filter((value): value is string => Boolean(value));
    for (const path of directPaths) {
      extractedIconDataUrl = await this.readIconPathFromArchive(
        archive,
        entriesByName,
        path,
        10_000,
      );
      if (extractedIconDataUrl) {
        break;
      }
    }

    let displayName = label.value ? normalizeApkDisplayName(label.value) : null;
    const labelId = displayName ? undefined : label.resourceId;
    const iconIds = extractedIconDataUrl
      ? []
      : [
          declaredIcons.iconResourceId,
          declaredIcons.roundIconResourceId,
        ].filter((id): id is number => id !== undefined);
    if (
      (labelId !== undefined || iconIds.length) &&
      entriesByName.has('resources.arsc')
    ) {
      const resources = await archive.readEntry(
        'resources.arsc',
        this.maxMetadataEntryBytes,
      );
      if (resources) {
        const metadata = readApkResourceMetadata(resources, labelId, iconIds);
        if (metadata.label)
          displayName = normalizeApkDisplayName(metadata.label);
        for (const candidate of metadata.icons) {
          extractedIconDataUrl = await this.readIconPathFromArchive(
            archive,
            entriesByName,
            candidate.entryName,
            candidate.score,
          );
          if (extractedIconDataUrl) break;
        }
      }
    }

    if (!extractedIconDataUrl) {
      extractedIconDataUrl = await this.iconSelector.selectBestIconDataUrl(
        entries,
        (candidate) => archive.readEntry(candidate.entry.name, maxIconBytes),
      );
    }

    return { extractedIconDataUrl, displayName, packageName };
  }

  private async readIconPathFromArchive(
    archive: ApkArchiveReader,
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

    const content = await archive.readEntry(normalizedPath, maxIconBytes);
    if (!content || content.length === 0) {
      return null;
    }

    return launcherIconDataUrl(normalizedPath, content, score);
  }
}
