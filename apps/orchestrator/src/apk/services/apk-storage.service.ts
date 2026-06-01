import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  link,
  mkdir,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Not, Repository } from 'typeorm';
import { UploadedApk } from '../entities/uploaded-apk.entity';

@Injectable()
export class ApkStorageService {
  constructor(
    @InjectRepository(UploadedApk)
    private readonly uploadedApks: Repository<UploadedApk>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Persists APK bytes under a content-addressed filename.
   * Existing files are treated as reusable shared storage.
   */
  async persistApk(sha256: string, content: Buffer) {
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

  async persistApkStream(stream: Readable, maxBytes: number) {
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

    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(temporaryPath, { flags: 'wx' }),
      );
      const sha256 = hash.digest('hex');
      const filePath = join(apkDir, `${sha256}.apk`);
      await link(temporaryPath, filePath).catch(
        async (error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') {
            throw error;
          }
          await unlink(temporaryPath);
        },
      );
      await unlink(temporaryPath).catch(() => undefined);
      return { filePath, sha256, sizeBytes };
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Deletes the underlying APK file only after the last database reference is gone.
   */
  async removeSharedFileIfUnused(upload: UploadedApk) {
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

  async removeSharedFileIfUnreferenced(upload: {
    sha256: string;
    filePath: string;
  }) {
    const references = await this.uploadedApks.countBy({
      sha256: upload.sha256,
    });
    if (references > 0) {
      return false;
    }

    await unlink(upload.filePath).catch(() => undefined);
    return true;
  }

  async cleanupOrphanedFiles() {
    const apkDir = await this.apkDirectory();
    const referenced = new Set(
      (await this.uploadedApks.find({ select: { sha256: true } })).map(
        (upload) => `${upload.sha256}.apk`,
      ),
    );
    const cutoff = Date.now() - 60 * 60 * 1000;
    let removed = 0;
    for (const name of await readdir(apkDir)) {
      if (
        (!name.endsWith('.apk') || referenced.has(name)) &&
        !name.endsWith('.upload')
      ) {
        continue;
      }
      const path = join(apkDir, name);
      if ((await stat(path)).mtimeMs > cutoff) {
        continue;
      }
      await unlink(path);
      removed += 1;
    }
    return removed;
  }

  private async apkDirectory() {
    const uploadsDir = this.config.getOrThrow<string>('app.uploadsDir');
    const apkDir = join(uploadsDir, 'apks');
    await mkdir(apkDir, { recursive: true });
    return apkDir;
  }
}
