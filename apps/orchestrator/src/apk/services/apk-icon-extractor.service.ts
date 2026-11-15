import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import type { ApkPackageInspectionPort } from '../contracts/apk-package-inspection.port';
import { maxIconBytes, ZipEntry } from '../types/apk.types';
import {
  imageMimeType,
  launcherIconDataUrl,
  normalizeApkDisplayName,
} from '../utils/apk-image.utils';
import { ApkArchiveService } from './apk-archive.service';
import { ApkIconSelectorService } from './apk-icon-selector.service';
import { ApkManifestReaderService } from './apk-manifest-reader.service';
import { ApkResourceReaderService } from './apk-resource-reader.service';

@Injectable()
export class ApkIconExtractorService implements ApkPackageInspectionPort {
  private readonly logger = new Logger(ApkIconExtractorService.name);
  private readonly maxMetadataEntryBytes = 64 * 1024 * 1024;

  constructor(
    private readonly archive: ApkArchiveService,
    private readonly iconSelector: ApkIconSelectorService,
    private readonly manifestReader: ApkManifestReaderService,
    private readonly resourceReader: ApkResourceReaderService,
  ) {}

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

      const packageName = this.manifestReader.readPackageName(manifest);
      const label = this.manifestReader.readApplicationLabel(manifest);
      const declaredIcons = this.manifestReader.readIconReferences(manifest);
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
        ? normalizeApkDisplayName(label.value)
        : null;
      if (!displayName && typeof label.resourceId === 'number') {
        const content = await getResources();
        const resolved = content
          ? this.resourceReader.readString(content, label.resourceId)
          : null;
        displayName = resolved ? normalizeApkDisplayName(resolved) : null;
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
          ? this.resourceReader
              .readIconCandidates(content, resourceIds)
              .sort((left, right) => right.score - left.score)
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
        extractedIconDataUrl = await this.iconSelector.selectBestIconDataUrl(
          entries,
          (candidate) =>
            this.archive.readEntry(
              filePath,
              candidate.entry.name,
              maxIconBytes,
            ),
        );
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

    return launcherIconDataUrl(normalizedPath, content, score);
  }
}
