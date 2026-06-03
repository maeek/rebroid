import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../common/error-message';
import {
  IconCandidate,
  maxCandidatesToRead,
  maxIconBytes,
  ZipEntry,
} from '../types/apk.types';
import { imageDimensions, imageMimeType } from '../utils/apk-image.utils';
import { ApkArchiveService } from './apk-archive.service';
import { ApkManifestReaderService } from './apk-manifest-reader.service';
import { ApkResourceReaderService } from './apk-resource-reader.service';
import { ApkZipReaderService } from './apk-zip-reader.service';

@Injectable()
export class ApkIconExtractorService {
  private readonly logger = new Logger(ApkIconExtractorService.name);
  private readonly maxMetadataEntryBytes = 64 * 1024 * 1024;

  constructor(
    private readonly archive: ApkArchiveService,
    private readonly manifestReader: ApkManifestReaderService,
    private readonly resourceReader: ApkResourceReaderService,
    private readonly zipReader: ApkZipReaderService,
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
        ? this.normalizeDisplayName(label.value)
        : null;
      if (!displayName && typeof label.resourceId === 'number') {
        const content = await getResources();
        const resolved = content
          ? this.resourceReader.readString(content, label.resourceId)
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

  /** Reads the manifest package name from an APK, best-effort. */
  extractPackageName(apk: Buffer) {
    try {
      const entries = this.zipReader.readCentralDirectory(apk);
      const manifestEntry = entries.find(
        (entry) => entry.name === 'AndroidManifest.xml',
      );
      if (!manifestEntry) {
        return null;
      }

      const manifest = this.zipReader.readEntry(apk, manifestEntry);
      return manifest ? this.manifestReader.readPackageName(manifest) : null;
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
      const entries = this.zipReader.readCentralDirectory(apk);
      const entriesByName = new Map(
        entries.map((entry) => [entry.name, entry]),
      );
      const manifestEntry = entriesByName.get('AndroidManifest.xml');
      if (!manifestEntry) {
        return null;
      }

      const manifest = this.zipReader.readEntry(apk, manifestEntry);
      if (!manifest) {
        return null;
      }

      const label = this.manifestReader.readApplicationLabel(manifest);
      if (label.value) {
        return this.normalizeDisplayName(label.value);
      }

      if (typeof label.resourceId !== 'number') {
        return null;
      }

      const resourcesEntry = entriesByName.get('resources.arsc');
      const resources = resourcesEntry
        ? this.zipReader.readEntry(apk, resourcesEntry)
        : null;
      const resolvedLabel = resources
        ? this.resourceReader.readString(resources, label.resourceId)
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
      const entries = this.zipReader.readCentralDirectory(apk);
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
        const content = this.zipReader.readEntry(apk, candidate.entry);
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

    const manifest = this.zipReader.readEntry(apk, manifestEntry);
    const resources = this.zipReader.readEntry(apk, resourcesEntry);
    if (!manifest || !resources) {
      return null;
    }

    const declaredIcons = this.manifestReader.readIconReferences(manifest);
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

    const resourceIconCandidates = this.resourceReader.readIconCandidates(
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

    const content = this.zipReader.readEntry(apk, entry);
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

  private normalizeDisplayName(value: string) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 0 ? normalized.slice(0, 120) : null;
  }
}
