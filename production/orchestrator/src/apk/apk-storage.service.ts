import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Not, Repository } from 'typeorm';
import { UploadedApk } from './uploaded-apk.entity';

@Injectable()
export class ApkStorageService {
  constructor(
    @InjectRepository(UploadedApk)
    private readonly uploadedApks: Repository<UploadedApk>,
    private readonly config: ConfigService,
  ) {}

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
}