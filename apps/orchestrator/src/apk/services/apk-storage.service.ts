import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { writeHashedUpload } from '../../common/write-hashed-upload';
import { KeyedSerialQueue } from '../../common/keyed-serial-queue';
import { UploadedApksRepository } from '../persistence/uploaded-apks.repository';

@Injectable()
export class ApkStorageService {
  private readonly logger = new Logger(ApkStorageService.name);
  private readonly hashOperations = new KeyedSerialQueue<string>();
  private readonly activeUploads = new Set<string>();

  withHash<T>(sha256: string, operation: () => Promise<T>): Promise<T> {
    return this.hashOperations.run(sha256, operation);
  }

  constructor(
    private readonly uploadedApks: UploadedApksRepository,
    private readonly config: ConfigService,
  ) {}

  async withPersistedApk<T>(
    stream: Readable,
    maxBytes: number,
    operation: (stored: {
      filePath: string;
      sha256: string;
      sizeBytes: number;
    }) => Promise<T>,
  ): Promise<T> {
    const apkDir = await this.apkDirectory();
    const temporaryPath = join(apkDir, `.${randomUUID()}.upload`);
    this.activeUploads.add(temporaryPath);
    try {
      const { sha256, sizeBytes } = await writeHashedUpload(
        stream,
        temporaryPath,
        maxBytes,
        () => new Error('APK upload exceeds the configured size limit.'),
      );
      const filePath = join(apkDir, `${sha256}.apk`);
      return await this.withHash(sha256, async () => {
        await link(temporaryPath, filePath).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'EEXIST') throw error;
          },
        );
        return operation({ filePath, sha256, sizeBytes });
      });
    } finally {
      this.activeUploads.delete(temporaryPath);
      await unlink(temporaryPath).catch(() => undefined);
    }
  }

  /** Called with the hash lock held while catalog references are changed. */
  async removeSharedFileIfUnreferenced(upload: {
    sha256: string;
    filePath: string;
  }) {
    const references = await this.uploadedApks.countBySha256(upload.sha256);
    if (references > 0) {
      return false;
    }

    return this.removeFile(upload.filePath);
  }

  /** Called under the hash lock. Orphan cleanup can retry after catalog commit. */
  async removeCatalogRecords(
    upload: { sha256: string; filePath?: string },
    removeRecords: () => Promise<unknown>,
  ) {
    await removeRecords();
    try {
      const { sha256 } = upload;
      const filePath =
        upload.filePath ?? join(await this.apkDirectory(), `${sha256}.apk`);
      return await this.removeSharedFileIfUnreferenced({ sha256, filePath });
    } catch (error) {
      this.logger.warn(
        `Could not check an APK for orphan cleanup: ${String(error)}`,
      );
      return false;
    }
  }

  async cleanupOrphanedFiles() {
    const apkDir = await this.apkDirectory();
    const referenced = await this.uploadedApks.referencedFileNames();
    const cutoff = Date.now() - 60 * 60 * 1000;
    let removed = 0;
    for (const name of await readdir(apkDir)) {
      const sha256 = name.endsWith('.apk') ? name.slice(0, -4) : null;
      if (
        referenced.has(name) ||
        (sha256 === null && !name.endsWith('.upload'))
      )
        continue;
      const path = join(apkDir, name);
      const deleteIfOrphaned = async () => {
        if (this.activeUploads.has(path)) return false;
        const metadata = await lstat(path).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
            return null;
          },
        );
        if (!metadata?.isFile() || metadata.mtimeMs > cutoff) return false;
        if (sha256 !== null && (await this.uploadedApks.countBySha256(sha256)))
          return false;
        return this.removeFile(path);
      };
      const deleted =
        sha256 === null
          ? await deleteIfOrphaned()
          : await this.withHash(sha256, deleteIfOrphaned);
      if (deleted) removed += 1;
    }
    return removed;
  }

  private async removeFile(path: string) {
    try {
      await unlink(path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(
          `Could not remove an unreferenced APK file: ${String(error)}`,
        );
      }
      return false;
    }
  }

  private async apkDirectory() {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const apkDir = join(uploadsDir, 'apks');
    await mkdir(apkDir, { recursive: true });
    return apkDir;
  }
}
