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
import {
  supportedGappsAndroidVersions,
  type SupportedGappsAndroidVersion,
} from '../dto/gapps-build.dto';
import { gappsTemporaryPackageDirectory } from '../utils/gapps-staging-paths';

@Injectable()
export class ContainerImageGappsCacheService {
  constructor(private readonly config: ConfigService) {}

  async findVerified(
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const { packagePath, checksumPath } = await this.revisionPaths(
      androidVersion,
      revision,
    );
    try {
      const expected = (await readFile(checksumPath, 'utf8')).trim();
      const actual = await this.calculateSha256(packagePath, signal);
      signal?.throwIfAborted();
      if (expected && expected === actual) {
        return { packagePath, sha256: actual };
      }
    } catch {
      signal?.throwIfAborted();
      return null;
    }
    await Promise.all([
      rm(packagePath, { force: true }),
      rm(checksumPath, { force: true }),
    ]);
    return null;
  }

  async createTemporaryPath(jobId: string) {
    const directory = gappsTemporaryPackageDirectory(
      this.config.getOrThrow<string>('app.uploadsDir'),
    );
    await mkdir(directory, { recursive: true });
    return join(directory, `${jobId}.zip`);
  }

  async promote(
    temporaryPath: string,
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
    expectedSha256: string,
    signal?: AbortSignal,
  ) {
    const { packagePath, checksumPath } = await this.revisionPaths(
      androidVersion,
      revision,
    );
    const sha256 = await this.calculateSha256(temporaryPath, signal);
    signal?.throwIfAborted();
    if (sha256 !== expectedSha256)
      throw new Error('GApps package changed during validation.');
    await rename(temporaryPath, packagePath);
    await writeFile(checksumPath, `${sha256}\n`, { mode: 0o600 });
    return { packagePath, sha256 };
  }

  async retainOnly(
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
  ) {
    const { directory, packagePath, checksumPath } = await this.revisionPaths(
      androidVersion,
      revision,
    );
    await Promise.all(
      (await readdir(directory))
        .map((name) => join(directory, name))
        .filter((path) => path !== packagePath && path !== checksumPath)
        .map((path) => rm(path, { recursive: true, force: true })),
    );
  }

  async clear(androidVersion: string) {
    if (
      !supportedGappsAndroidVersions.some(
        (version) => version === androidVersion,
      )
    ) {
      throw new ConflictException(
        `Unsupported GApps Android version. Supported versions: ${supportedGappsAndroidVersions.join(', ')}.`,
      );
    }
    await rm(this.versionDirectory(androidVersion), {
      recursive: true,
      force: true,
    });
    return { androidVersion, cleared: true };
  }

  removeTemporary(path: string) {
    return rm(path, { force: true });
  }

  private versionDirectory(androidVersion: string) {
    return join(
      this.config.getOrThrow<string>('app.uploadsDir'),
      'image-build-gapps-cache',
      androidVersion,
    );
  }

  private async revisionPaths(
    androidVersion: SupportedGappsAndroidVersion,
    revision: string,
  ) {
    const directory = this.versionDirectory(androidVersion);
    await mkdir(directory, { recursive: true });
    // Older Android 15 and 16 archives lack the compatible GSF used by the patch worker.
    const stem =
      androidVersion === '15' || androidVersion === '16'
        ? `${revision}-gsf-compat-v1`
        : revision;
    return {
      directory,
      packagePath: join(directory, `${stem}.zip`),
      checksumPath: join(directory, `${stem}.sha256`),
    };
  }

  async calculateSha256(path: string, signal?: AbortSignal) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path, { signal })) {
      hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
  }
}
