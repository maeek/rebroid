import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { In, IsNull, Repository } from 'typeorm';
import { AndroidApplication } from '../../android-apps/android-application.entity';
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

  /**
   * Deduplicates APK uploads by hash and owner before persisting the shared file.
   * Existing records may still get an updated extracted icon.
   */
  async upload(apk: Express.Multer.File, ownerUserId?: string | null) {
    if (!apk) {
      throw new ConflictException('An APK file is required.');
    }

    await this.ensureMetadataColumns();
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
      const displayName = this.iconExtractor.extractDisplayName(apk.buffer);
      const packageName = this.iconExtractor.extractPackageName(apk.buffer);
      if (
        (extractedIconDataUrl &&
          extractedIconDataUrl !== existing.extractedIconDataUrl) ||
        (displayName && displayName !== existing.displayName) ||
        (packageName && packageName !== existing.packageName)
      ) {
        existing.extractedIconDataUrl =
          extractedIconDataUrl ?? existing.extractedIconDataUrl;
        existing.displayName = displayName ?? existing.displayName;
        existing.packageName = packageName ?? existing.packageName;
        await this.uploadedApks.save(existing);
      }
      return existing;
    }

    const extractedIconDataUrl = this.iconExtractor.extractLauncherIconDataUrl(
      apk.buffer,
    );
    const displayName = this.iconExtractor.extractDisplayName(apk.buffer);
    const packageName = this.iconExtractor.extractPackageName(apk.buffer);
    const filePath = await this.storage.persistApk(sha256, apk.buffer);
    const uploaded = this.uploadedApks.create({
      ownerUserId: owner,
      originalName: apk.originalname || `${sha256}.apk`,
      sha256,
      sizeBytes: apk.size,
      filePath,
      extractedIconDataUrl,
      displayName,
      packageName,
    });

    return this.uploadedApks.save(uploaded);
  }

  async findBySha256(sha256: string, ownerUserId?: string | null) {
    await this.ensureMetadataColumns();
    const owner = ownerUserId?.trim() || null;
    return this.uploadedApks.findOneBy({
      sha256,
      ownerUserId: owner ?? IsNull(),
    });
  }

  async list(ownerUserId?: string) {
    await this.ensureMetadataColumns();
    return this.uploadedApks.find({
      where: ownerUserId ? { ownerUserId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Loads an uploaded APK or throws when the id does not exist.
   */
  async get(id: string) {
    await this.ensureMetadataColumns();
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
    await this.ensureMetadataColumns();
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
      if (await this.storage.removeSharedFileIfUnused(upload)) {
        removedFiles += 1;
      }
    }

    return { deletedRecords: unused.length, removedFiles };
  }

  private async ensureMetadataColumns() {
    const columns = (await this.uploadedApks.query(
      `PRAGMA table_info('uploaded_apks')`,
    )) as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('displayName')) {
      await this.uploadedApks.query(
        `ALTER TABLE uploaded_apks ADD COLUMN displayName text`,
      );
    }

    if (!columnNames.has('packageName')) {
      await this.uploadedApks.query(
        `ALTER TABLE uploaded_apks ADD COLUMN packageName text`,
      );
    }
  }
}
