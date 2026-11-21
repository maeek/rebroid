import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { link, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { UploadedApksRepository } from '../persistence/uploaded-apks.repository';

@Injectable()
export class ApkStorageService {
  private readonly logger = new Logger(ApkStorageService.name);
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly activeUploads = new Set<string>();

  async withHash<T>(sha256: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(sha256) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.pending.set(sha256, current);
    try {
      return await current;
    } finally {
      if (this.pending.get(sha256) === current) this.pending.delete(sha256);
    }
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
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        sizeBytes += chunk.length;
        if (sizeBytes > maxBytes) {
          callback(new Error('APK upload exceeds the configured size limit.'));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    this.activeUploads.add(temporaryPath);
    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      const sha256 = hash.digest('hex');
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
      if (
        (!name.endsWith('.apk') || referenced.has(name)) &&
        !name.endsWith('.upload')
      )
        continue;
      const path = join(apkDir, name);
      const deleteIfOrphaned = async () => {
        if (this.activeUploads.has(path)) return false;
        const metadata = await stat(path).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
            return null;
          },
        );
        if (!metadata || metadata.mtimeMs > cutoff) return false;
        if (name.endsWith('.apk')) {
          const sha256 = name.slice(0, -4);
          if (await this.uploadedApks.countBySha256(sha256)) return false;
        }
        return this.removeFile(path);
      };
      const deleted = name.endsWith('.apk')
        ? await this.withHash(name.slice(0, -4), deleteIfOrphaned)
        : await deleteIfOrphaned();
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
