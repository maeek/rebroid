import {
  ConflictException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Busboy from 'busboy';
import { In, IsNull, Repository } from 'typeorm';
import { AndroidApplication } from '../../android-apps/android-application.entity';
import {
  type MultipartUploadRequest,
  isMultipartUpload,
} from '../../common/http-upload';
import { SettingsService } from '../../settings/settings.service';
import { UploadedApk } from '../entities/uploaded-apk.entity';
import { ApkIconExtractorService } from './apk-icon-extractor.service';
import { ApkStorageService } from './apk-storage.service';

@Injectable()
export class ApkCatalogService {
  constructor(
    @InjectRepository(UploadedApk)
    private readonly uploadedApks: Repository<UploadedApk>,
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly settings: SettingsService,
    private readonly storage: ApkStorageService,
    private readonly iconExtractor: ApkIconExtractorService,
  ) {}

  async upload(request: MultipartUploadRequest, ownerUserId?: string | null) {
    if (!isMultipartUpload(request.headers)) {
      throw new ConflictException('A multipart APK upload is required.');
    }

    const maxBytes = await this.settings.getMaxApkUploadBytes();
    const parser = Busboy({
      headers: request.headers,
      limits: { files: 1, fileSize: maxBytes },
    });

    return new Promise<UploadedApk>((resolve, reject) => {
      let upload: Promise<UploadedApk> | null = null;
      let settled = false;
      const finish = (callback: () => void) => {
        if (!settled) {
          settled = true;
          callback();
        }
      };
      const fail = (error: unknown) => finish(() => reject(error));

      parser.on('file', (fieldName, stream, info) => {
        if (fieldName !== 'apk' || upload) {
          stream.resume();
          return;
        }
        let exceededLimit = false;
        stream.on('limit', () => {
          exceededLimit = true;
          fail(
            new PayloadTooLargeException(
              `APK exceeds configured upload limit of ${maxBytes / 1024 / 1024} MB.`,
            ),
          );
        });
        upload = this.storage
          .persistApkStream(stream, maxBytes)
          .then(async (stored) => {
            if (exceededLimit) {
              await this.storage.removeSharedFileIfUnreferenced(stored);
              throw new PayloadTooLargeException(
                `APK exceeds configured upload limit of ${maxBytes / 1024 / 1024} MB.`,
              );
            }

            return this.saveUploadedApk(
              stored,
              info.filename || `${stored.sha256}.apk`,
              ownerUserId,
            ).catch(async (error) => {
              await this.storage.removeSharedFileIfUnreferenced(stored);
              throw error;
            });
          });
        upload.catch(fail);
      });
      parser.on('error', fail);
      request.on('aborted', () =>
        fail(new ConflictException('APK upload was cancelled.')),
      );
      request.on('error', fail);
      parser.on('finish', () => {
        if (!upload) {
          fail(new ConflictException('An APK file is required.'));
          return;
        }
        upload.then((result) => finish(() => resolve(result)), fail);
      });
      request.pipe(parser);
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
    const metadata = await this.iconExtractor.extractMetadataFromFile(filePath);
    const existing = await this.uploadedApks.findOneBy({
      sha256,
      ownerUserId: owner ?? IsNull(),
    });
    if (existing) {
      if (
        (metadata.extractedIconDataUrl &&
          metadata.extractedIconDataUrl !== existing.extractedIconDataUrl) ||
        (metadata.displayName &&
          metadata.displayName !== existing.displayName) ||
        (metadata.packageName && metadata.packageName !== existing.packageName)
      ) {
        existing.extractedIconDataUrl =
          metadata.extractedIconDataUrl ?? existing.extractedIconDataUrl;
        existing.displayName = metadata.displayName ?? existing.displayName;
        existing.packageName = metadata.packageName ?? existing.packageName;
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
    });

    return this.uploadedApks.save(uploaded);
  }

  async findBySha256(sha256: string, ownerUserId?: string | null) {
    const owner = ownerUserId?.trim() || null;
    return this.uploadedApks.findOneBy({
      sha256,
      ownerUserId: owner ?? IsNull(),
    });
  }

  async list(ownerUserId?: string) {
    return this.uploadedApks.find({
      where: ownerUserId ? { ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Loads an uploaded APK or throws when the id does not exist.
   */
  async get(id: string) {
    const uploaded = await this.uploadedApks.findOneBy({ id });
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
    const owner = ownerUserId?.trim() || null;
    const existing = await this.uploadedApks.findOneBy({
      sha256: source.sha256,
      ownerUserId: owner ?? IsNull(),
    });

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
    });

    return this.uploadedApks.save(upload);
  }

  /**
   * Deletes an upload record only when no application still references it.
   */
  async remove(id: string) {
    const uploaded = await this.get(id);
    const inUseCount = await this.applications.countBy({ uploadedApkId: id });
    if (inUseCount > 0) {
      throw new ConflictException(
        'Uploaded APK is used by one or more Android applications.',
      );
    }

    await this.uploadedApks.remove(uploaded);
    await this.storage.removeSharedFileIfUnused(uploaded);
    return uploaded;
  }

  /**
   * Removes unreferenced uploads and deletes shared files only after the last reference is gone.
   */
  async cleanupUnused(ownerUserId?: string | null) {
    const owner = ownerUserId?.trim();
    const uploads = await this.uploadedApks.find({
      where: owner ? { ownerUserId: owner } : {},
    });
    const ids = uploads.map((upload) => upload.id);
    if (ids.length === 0) {
      return {
        deletedRecords: 0,
        removedFiles: await this.storage.cleanupOrphanedFiles(),
      };
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
      if (await this.storage.removeSharedFileIfUnused(upload)) {
        removedFiles += 1;
      }
    }

    removedFiles += await this.storage.cleanupOrphanedFiles();
    return { deletedRecords: unused.length, removedFiles };
  }
}
