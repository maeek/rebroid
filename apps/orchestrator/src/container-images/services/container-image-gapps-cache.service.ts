import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import type { SupportedGappsAndroidVersion } from '../dto/gapps-build.dto';

@Injectable()
export class ContainerImageGappsCacheService {
  constructor(private readonly config: ConfigService) {}

  async findVerified(
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
  ) {
    const directory = await this.versionDirectory(androidVersion);
    const packagePath = join(directory, `${revision}.zip`);
    const checksumPath = join(directory, `${revision}.sha256`);
    try {
      const expected = (await readFile(checksumPath, 'utf8')).trim();
      const actual = await this.calculateSha256(packagePath);
      if (expected && expected === actual) {
        return { packagePath, sha256: actual };
      }
    } catch {
      return null;
    }
    await Promise.all([
      rm(packagePath, { force: true }),
      rm(checksumPath, { force: true }),
    ]);
    return null;
  }

  async createTemporaryPath(jobId: string) {
    const directory = join(
      this.config.getOrThrow<string>('app.uploadsDir'),
      'image-build-gapps-cache',
      'temporary',
    );
    await mkdir(directory, { recursive: true });
    return join(directory, `${jobId}.zip`);
  }

  async promote(
    temporaryPath: string,
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
  ) {
    const directory = await this.versionDirectory(androidVersion);
    const packagePath = join(directory, `${revision}.zip`);
    const checksumPath = join(directory, `${revision}.sha256`);
    const sha256 = await this.calculateSha256(temporaryPath);
    await rm(packagePath, { force: true });
    await rename(temporaryPath, packagePath);
    await writeFile(checksumPath, `${sha256}\n`, { mode: 0o600 });
    return { packagePath, sha256 };
  }

  async retainOnly(
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
  ) {
    const directory = await this.versionDirectory(androidVersion);
    const keep = new Set([`${revision}.zip`, `${revision}.sha256`]);
    await Promise.all(
      (await readdir(directory))
        .filter((name) => !keep.has(name))
        .map((name) =>
          rm(join(directory, name), { recursive: true, force: true }),
        ),
    );
  }

  async clear(androidVersion: string) {
    if (androidVersion !== '13' && androidVersion !== '14') {
      throw new ConflictException('Android version must be 13 or 14.');
    }
    const directory = join(
      this.config.getOrThrow<string>('app.uploadsDir'),
      'image-build-gapps-cache',
      androidVersion,
    );
    await rm(directory, { recursive: true, force: true });
    return { androidVersion, cleared: true };
  }

  removeTemporary(path: string) {
    return rm(path, { force: true });
  }

  private async versionDirectory(androidVersion: SupportedGappsAndroidVersion) {
    const directory = join(
      this.config.getOrThrow<string>('app.uploadsDir'),
      'image-build-gapps-cache',
      androidVersion,
    );
    await mkdir(directory, { recursive: true });
    return directory;
  }

  calculateSha256(path: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(hash.digest('hex')));
    });
  }
}
