import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';
import { SettingsService } from '../settings/settings.service';
import { ApkIconExtractorService } from './apk-icon-extractor.service';
import { ApkStorageService } from './apk-storage.service';
import { UploadedApk } from './uploaded-apk.entity';

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

  /**
   * Deduplicates APK uploads by hash and owner before persisting the shared file.
   * Existing records may still get an updated extracted icon.
   */
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
      const extractedIconDataUrl =
        this.iconExtractor.extractLauncherIconDataUrl(apk.buffer);
      if (
        extractedIconDataUrl &&
        extractedIconDataUrl !== existing.extractedIconDataUrl
      ) {
        existing.extractedIconDataUrl = extractedIconDataUrl;
        await this.uploadedApks.save(existing);
      }
      return existing;
    }

    const extractedIconDataUrl =
      this.iconExtractor.extractLauncherIconDataUrl(apk.buffer);
    const filePath = await this.storage.persistApk(sha256, apk.buffer);
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
      return { deletedRecords: 0, removedFiles: 0 };
    }

    const used = await this.applications.find({
      select: { uploadedApkId: true },
      where: { uploadedApkId: In(ids) },
    });
    const usedIds = new Set(used.map((app) => app.uploadedApkId).filter(Boolean));
    const unused = uploads.filter((upload) => !usedIds.has(upload.id));

    let removedFiles = 0;
    for (const upload of unused) {
      await this.uploadedApks.remove(upload);
      if (await this.storage.removeSharedFileIfUnused(upload)) {
        removedFiles += 1;
      }
    }

    return { deletedRecords: unused.length, removedFiles };
  }
}