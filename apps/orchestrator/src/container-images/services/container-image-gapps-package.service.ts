import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import {
  APK_PACKAGE_INSPECTION,
  type ApkPackageInspectionPort,
} from '../../apk/contracts/apk-package-inspection.port';
import {
  gappsSystemRelativePath,
  rejectGappsSymlinkParent,
  validateGappsArchivePath,
  validateGappsSymlinkTarget,
} from '../utils/gapps-package-paths';

const maxArchiveEntries = 50_000;
const maxExtractedBytes = 4 * 1024 ** 3;
const maxSymlinkBytes = 4 * 1024;
const unixFileTypeMask = 0o170000;
const unixRegularFile = 0o100000;
const unixDirectory = 0o040000;
const unixSymlink = 0o120000;
const forbiddenUnixTypes = new Set([0o010000, 0o020000, 0o060000, 0o140000]);

@Injectable()
export class ContainerImageGappsPackageService {
  constructor(
    private readonly config: ConfigService,
    @Inject(APK_PACKAGE_INSPECTION)
    private readonly apkInspection: ApkPackageInspectionPort,
  ) {}

  async extract(packagePath: string, jobId: string) {
    const workDirectory = join(
      this.config.getOrThrow<string>('app.uploadsDir'),
      'image-build-gapps-work',
      jobId,
    );
    await rm(workDirectory, { recursive: true, force: true });
    await mkdir(workDirectory, { recursive: true, mode: 0o700 });
    await this.extractSystemTree(packagePath, workDirectory);
    return workDirectory;
  }

  cleanup(workDirectory: string) {
    return rm(workDirectory, { recursive: true, force: true });
  }

  async validate(workDirectory: string) {
    const files = await this.listFiles(join(workDirectory, 'system'));
    const apkFiles = files.filter((path) =>
      path.toLowerCase().endsWith('.apk'),
    );
    apkFiles.sort(
      (left, right) => this.apkPriority(left) - this.apkPriority(right),
    );
    const packageNames = new Set<string>();
    for (const apkPath of apkFiles) {
      const packageName =
        await this.apkInspection.extractPackageNameFromFile(apkPath);
      if (packageName) packageNames.add(packageName);
      if (
        packageNames.has('com.google.android.gms') &&
        packageNames.has('com.android.vending')
      ) {
        break;
      }
    }

    const privilegedPermissionXml = await this.findPrivilegedPermissionXml(
      files.filter((path) => path.toLowerCase().endsWith('.xml')),
    );
    const requiredPackages = ['com.google.android.gms', 'com.android.vending'];
    const missingPackages = requiredPackages.filter(
      (packageName) => !packageNames.has(packageName),
    );
    if (missingPackages.length > 0 || !privilegedPermissionXml) {
      const missing = [
        ...missingPackages,
        ...(privilegedPermissionXml
          ? []
          : ['Google privileged-permission XML']),
      ];
      throw new Error(
        `GApps package validation failed; missing ${missing.join(', ')}.`,
      );
    }

    return {
      packageNames: requiredPackages,
      privilegedPermissionXml,
      extractedFileCount: files.length,
    };
  }

  private extractSystemTree(packagePath: string, workDirectory: string) {
    return new Promise<void>((resolve, reject) => {
      yauzl.open(
        packagePath,
        { lazyEntries: true, autoClose: false },
        (openError, archive) => {
          if (openError || !archive) {
            reject(openError ?? new Error('Could not open GApps package.'));
            return;
          }
          let entryCount = 0;
          let extractedBytes = 0;
          let settled = false;
          const symlinkPaths = new Set<string>();
          const extractedPaths = new Set<string>();
          const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            archive.close();
            callback();
          };
          archive.on('error', (error) => finish(() => reject(error)));
          archive.on('entry', (entry: Entry) => {
            entryCount += 1;
            if (entryCount > maxArchiveEntries) {
              finish(() =>
                reject(new Error('GApps package has too many entries.')),
              );
              return;
            }
            void this.extractEntry({
              archive,
              entry,
              workDirectory,
              symlinkPaths,
              extractedPaths,
              extractedBytes,
            })
              .then((bytes) => {
                extractedBytes += bytes;
                if (extractedBytes > maxExtractedBytes) {
                  throw new Error('Extracted GApps payload exceeds 4 GB.');
                }
                archive.readEntry();
              })
              .catch((error) => finish(() => reject(error)));
          });
          archive.on('end', () => {
            const systemPath = join(workDirectory, 'system');
            void lstat(systemPath)
              .then((value) => {
                if (!value.isDirectory()) {
                  throw new Error(
                    'GApps package does not contain a system tree.',
                  );
                }
                finish(resolve);
              })
              .catch((error) => finish(() => reject(error)));
          });
          archive.readEntry();
        },
      );
    });
  }

  private async extractEntry(input: {
    archive: ZipFile;
    entry: Entry;
    workDirectory: string;
    symlinkPaths: Set<string>;
    extractedPaths: Set<string>;
    extractedBytes: number;
  }) {
    const { archive, entry, workDirectory, symlinkPaths, extractedPaths } =
      input;
    const archivePath = validateGappsArchivePath(entry.fileName);
    const systemPath = gappsSystemRelativePath(archivePath);
    if (!systemPath) return 0;
    if (input.extractedBytes + entry.uncompressedSize > maxExtractedBytes) {
      throw new Error('Extracted GApps payload exceeds 4 GB.');
    }
    rejectGappsSymlinkParent(systemPath, symlinkPaths);

    const mode = entry.externalFileAttributes >>> 16;
    const fileType = mode & unixFileTypeMask;
    if (forbiddenUnixTypes.has(fileType)) {
      throw new Error(
        `GApps package contains a special device entry: ${archivePath}`,
      );
    }
    const destination = join(workDirectory, ...systemPath.split('/'));
    const isDirectory =
      entry.fileName.endsWith('/') || fileType === unixDirectory;
    const safeMode = mode & 0o1777 || (isDirectory ? 0o755 : 0o644);
    if (isDirectory) {
      await mkdir(destination, { recursive: true, mode: safeMode });
      await chmod(destination, safeMode);
      extractedPaths.add(systemPath);
      return 0;
    }

    await mkdir(dirname(destination), { recursive: true, mode: 0o755 });
    if (fileType === unixSymlink) {
      if (
        [...extractedPaths].some((path) => path.startsWith(`${systemPath}/`))
      ) {
        throw new Error(
          `GApps symlink replaces an extracted directory: ${archivePath}`,
        );
      }
      const target = (
        await this.readEntry(archive, entry, maxSymlinkBytes)
      ).toString('utf8');
      validateGappsSymlinkTarget(systemPath, target);
      await symlink(target, destination);
      symlinkPaths.add(systemPath);
      extractedPaths.add(systemPath);
      return entry.uncompressedSize;
    }
    if (fileType !== 0 && fileType !== unixRegularFile) {
      throw new Error(
        `GApps package contains an unsupported entry: ${archivePath}`,
      );
    }

    const source = await this.openEntry(archive, entry);
    await pipeline(
      source,
      createWriteStream(destination, { flags: 'wx', mode: safeMode }),
    );
    await chmod(destination, safeMode);
    extractedPaths.add(systemPath);
    return entry.uncompressedSize;
  }

  private openEntry(archive: ZipFile, entry: Entry) {
    return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      archive.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          reject(error ?? new Error(`Could not read ${entry.fileName}.`));
          return;
        }
        resolve(stream);
      });
    });
  }

  private async readEntry(archive: ZipFile, entry: Entry, maxBytes: number) {
    if (entry.uncompressedSize > maxBytes) {
      throw new Error(`GApps entry is too large: ${entry.fileName}`);
    }
    const stream = await this.openEntry(archive, entry);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        throw new Error(`GApps entry is too large: ${entry.fileName}`);
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks, size);
  }

  private async listFiles(directory: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        result.push(...(await this.listFiles(path)));
      } else if (entry.isFile()) {
        result.push(path);
      }
    }
    return result;
  }

  private apkPriority(path: string) {
    const normalized = path.toLowerCase();
    if (normalized.includes('gmscore')) return 0;
    if (normalized.includes('phonesky') || normalized.includes('vending'))
      return 1;
    return 2;
  }

  private async findPrivilegedPermissionXml(paths: string[]) {
    for (const path of paths) {
      const normalized = path.toLowerCase();
      if (!normalized.includes('permission')) continue;
      const fileStat = await lstat(path);
      if (fileStat.size > 2 * 1024 * 1024) continue;
      const content = await readFile(path, 'utf8').catch(() => '');
      if (
        content.includes('com.google.android.gms') ||
        content.includes('com.android.vending')
      ) {
        return basename(path);
      }
    }
    return null;
  }
}
