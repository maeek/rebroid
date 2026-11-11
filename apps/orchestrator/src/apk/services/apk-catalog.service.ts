import {
  ConflictException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  ANDROID_APPS_APK_REFERENCES,
  type AndroidAppsApkReferencesPort,
} from '../../android-apps/contracts/android-apps-apk-references.port';
import {
  type MultipartUploadRequest,
  consumeSingleFileUpload,
} from '../../common/http-upload';
import { SettingsService } from '../../settings/settings.service';
import type { ApkCatalogPort } from '../contracts/apk-catalog.port';
import { UploadedApksRepository } from '../persistence/uploaded-apks.repository';
import { ApkIconExtractorService } from './apk-icon-extractor.service';
import { ApkGooglePlayServicesAnalyzerService } from './apk-google-play-services-analyzer.service';
import { ApkStorageService } from './apk-storage.service';

@Injectable()
export class ApkCatalogService implements ApkCatalogPort {
  constructor(
    private readonly uploadedApks: UploadedApksRepository,
    @Inject(ANDROID_APPS_APK_REFERENCES)
    private readonly applicationReferences: AndroidAppsApkReferencesPort,
    private readonly settings: SettingsService,
    private readonly storage: ApkStorageService,
    private readonly iconExtractor: ApkIconExtractorService,
    private readonly googlePlayServicesAnalyzer: ApkGooglePlayServicesAnalyzerService,
  ) {}

  async upload(request: MultipartUploadRequest, ownerUserId?: string | null) {
    const maxBytes = await this.settings.getMaxApkUploadBytes();
    return consumeSingleFileUpload({
      request,
      fieldName: 'apk',
      maxBytes,
      missingError: () => new ConflictException('An APK file is required.'),
      limitError: () =>
        new PayloadTooLargeException(
          `APK exceeds configured upload limit of ${maxBytes / 1024 / 1024} MB.`,
        ),
      canceledError: () => new ConflictException('APK upload was cancelled.'),
      consume: (stream, originalName, limitExceeded) =>
        this.storage.withPersistedApk(stream, maxBytes, async (stored) => {
          if (limitExceeded()) {
            await this.storage.removeSharedFileIfUnreferenced(stored);
            throw new PayloadTooLargeException(
              `APK exceeds configured upload limit of ${maxBytes / 1024 / 1024} MB.`,
            );
          }
          return this.saveUploadedApk(
            stored,
            originalName || `${stored.sha256}.apk`,
            ownerUserId,
          ).catch(async (error) => {
            await this.storage.removeSharedFileIfUnreferenced(stored);
            throw error;
          });
        }),
    });
  }

  /**
   * Deduplicates APK uploads by hash and owner after the stream is persisted.
   * Existing records may still get updated extracted metadata.
   */
  private async saveUploadedApk(
    stored: { filePath: string; sha256: string; sizeBytes: number },
    originalName: string,
    ownerUserId?: string | null,
  ) {
    const { filePath, sha256, sizeBytes } = stored;
    const owner = ownerUserId?.trim() || null;
    const [metadata, googlePlayServices] = await Promise.all([
      this.iconExtractor.extractMetadataFromFile(filePath),
      this.googlePlayServicesAnalyzer.analyze(filePath),
    ]);
    const existing = await this.uploadedApks.findBySha256ForOwner(
      sha256,
      owner,
    );
    if (existing) {
      if (
        (metadata.extractedIconDataUrl &&
          metadata.extractedIconDataUrl !== existing.extractedIconDataUrl) ||
        (metadata.displayName &&
          metadata.displayName !== existing.displayName) ||
        (metadata.packageName &&
          metadata.packageName !== existing.packageName) ||
        googlePlayServices.verdict !== existing.googlePlayServicesVerdict ||
        googlePlayServices.analysisVersion !==
          existing.googlePlayServicesAnalysisVersion ||
        JSON.stringify(googlePlayServices.evidence) !==
          existing.googlePlayServicesEvidenceJson
      ) {
        existing.extractedIconDataUrl =
          metadata.extractedIconDataUrl ?? existing.extractedIconDataUrl;
        existing.displayName = metadata.displayName ?? existing.displayName;
        existing.packageName = metadata.packageName ?? existing.packageName;
        existing.googlePlayServicesVerdict = googlePlayServices.verdict;
        existing.googlePlayServicesEvidenceJson = JSON.stringify(
          googlePlayServices.evidence,
        );
        existing.googlePlayServicesAnalysisVersion =
          googlePlayServices.analysisVersion;
        await this.uploadedApks.save(existing);
      }
      return existing;
    }

    const uploaded = this.uploadedApks.create({
      ownerUserId: owner,
      originalName,
      sha256,
      sizeBytes,
      filePath,
      ...metadata,
      googlePlayServicesVerdict: googlePlayServices.verdict,
      googlePlayServicesEvidenceJson: JSON.stringify(
        googlePlayServices.evidence,
      ),
      googlePlayServicesAnalysisVersion: googlePlayServices.analysisVersion,
    });

    return this.uploadedApks.save(uploaded);
  }

  async findBySha256(sha256: string, ownerUserId?: string | null) {
    return this.uploadedApks.findBySha256ForOwner(sha256, ownerUserId);
  }

  async list(ownerUserId?: string) {
    return this.uploadedApks.list(ownerUserId);
  }

  /**
   * Loads an uploaded APK or throws when the id does not exist.
   */
  async get(id: string) {
    const uploaded = await this.uploadedApks.findById(id);
    if (!uploaded) {
      throw new ConflictException(`Uploaded APK "${id}" was not found.`);
    }

    return uploaded;
  }

  /**
   * Reuses the shared APK file while creating an owner-scoped upload record.
   * This lets admins fork an application without granting access to the
   * original owner's upload record.
   */
  async cloneForOwner(id: string, ownerUserId?: string | null) {
    const source = await this.get(id);
    return this.storage.withHash(source.sha256, () =>
      this.cloneStoredForOwner(id, ownerUserId),
    );
  }

  private async cloneStoredForOwner(id: string, ownerUserId?: string | null) {
    const source = await this.get(id);
    const owner = ownerUserId?.trim() || null;
    const existing = await this.uploadedApks.findBySha256ForOwner(
      source.sha256,
      owner,
    );

    if (existing) {
      return existing;
    }

    const upload = this.uploadedApks.create({
      ownerUserId: owner,
      originalName: source.originalName,
      sha256: source.sha256,
      sizeBytes: source.sizeBytes,
      filePath: source.filePath,
      extractedIconDataUrl: source.extractedIconDataUrl,
      displayName: source.displayName,
      packageName: source.packageName,
      googlePlayServicesVerdict: source.googlePlayServicesVerdict,
      googlePlayServicesEvidenceJson: source.googlePlayServicesEvidenceJson,
      googlePlayServicesAnalysisVersion:
        source.googlePlayServicesAnalysisVersion,
    });

    return this.uploadedApks.save(upload);
  }

  /**
   * Deletes an upload record only when no application still references it.
   */
  async remove(id: string) {
    const uploaded = await this.get(id);
    return this.storage.withHash(uploaded.sha256, async () => {
      const current = await this.get(id);
      const inUseCount =
        await this.applicationReferences.countUsingUploadedApk(id);
      if (inUseCount > 0) {
        throw new ConflictException(
          'Uploaded APK is used by one or more Android applications.',
        );
      }
      const deleted = { ...current };
      await this.uploadedApks.remove(current);
      await this.storage.removeSharedFileIfUnreferenced(deleted);
      return deleted;
    });
  }

  /**
   * Removes unreferenced uploads and deletes shared files only after the last reference is gone.
   */
  async cleanupUnused(ownerUserId?: string | null) {
    const uploads = await this.uploadedApks.listForCleanup(ownerUserId);
    const usedIds =
      uploads.length > 0
        ? await this.applicationReferences.findReferencedUploadedApkIds(
            uploads.map(({ id }) => id),
          )
        : new Set<string>();
    let removedFiles = 0;
    let deletedRecords = 0;
    for (const upload of uploads) {
      if (usedIds.has(upload.id)) continue;
      await this.storage.withHash(upload.sha256, async () => {
        const current = await this.uploadedApks.findById(upload.id);
        if (!current) return;
        if (await this.applicationReferences.countUsingUploadedApk(current.id))
          return;
        await this.uploadedApks.remove(current);
        deletedRecords += 1;
        if (await this.storage.removeSharedFileIfUnreferenced(current))
          removedFiles += 1;
      });
    }

    removedFiles += await this.storage.cleanupOrphanedFiles();
    return { deletedRecords, removedFiles };
  }
}
