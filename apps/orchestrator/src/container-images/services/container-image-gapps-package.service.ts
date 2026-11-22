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
import { gappsWorkDirectory } from '../utils/gapps-staging-paths';

const maxArchiveEntries = 50_000;
const maxExtractedBytes = 4 * 1024 ** 3;
const maxSymlinkBytes = 4 * 1024;
const unixFileTypeMask = 0o170000;
const unixRegularFile = 0o100000;
const unixDirectory = 0o040000;
const unixSymlink = 0o120000;
const forbiddenUnixTypes = new Set([0o010000, 0o020000, 0o060000, 0o140000]);
const requiredPackages = [
  'com.google.android.gms',
  'com.android.vending',
  'com.google.android.gsf',
];

@Injectable()
export class ContainerImageGappsPackageService {
  constructor(
    private readonly config: ConfigService,
    @Inject(APK_PACKAGE_INSPECTION)
    private readonly apkInspection: ApkPackageInspectionPort,
  ) {}

  async extract(packagePath: string, jobId: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const workDirectory = join(
      gappsWorkDirectory(this.config.getOrThrow<string>('app.uploadsDir')),
      jobId,
    );
    await rm(workDirectory, { recursive: true, force: true });
    await mkdir(workDirectory, { recursive: true, mode: 0o700 });
    try {
      await this.extractSystemTree(packagePath, workDirectory, signal);
      return workDirectory;
    } catch (error) {
      await this.cleanup(workDirectory);
      throw error;
    }
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
      if (requiredPackages.every((name) => packageNames.has(name))) break;
    }

    const privilegedPermissionXml = await this.findPrivilegedPermissionXml(
      files.filter((path) => path.toLowerCase().endsWith('.xml')),
    );
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

  private async extractSystemTree(
    packagePath: string,
    workDirectory: string,
    signal?: AbortSignal,
  ) {
    let entryCount = 0;
    let extractedBytes = 0;
    const symlinkPaths = new Set<string>();
    const extractedPaths = new Set<string>();
    const archive = await yauzl.openPromise(packagePath);
    for await (const entry of archive.eachEntry()) {
      signal?.throwIfAborted();
      if (++entryCount > maxArchiveEntries) {
        throw new Error('GApps package has too many entries.');
      }
      extractedBytes += await this.extractEntry({
        archive,
        entry,
        workDirectory,
        symlinkPaths,
        extractedPaths,
        extractedBytes,
        signal,
      });
      if (extractedBytes > maxExtractedBytes) {
        throw new Error('Extracted GApps payload exceeds 4 GB.');
      }
    }
    signal?.throwIfAborted();
    const system = await lstat(join(workDirectory, 'system'));
    if (!system.isDirectory()) {
      throw new Error('GApps package does not contain a system tree.');
    }
  }

  private async extractEntry(input: {
    archive: ZipFile;
    entry: Entry;
    workDirectory: string;
    symlinkPaths: Set<string>;
    extractedPaths: Set<string>;
    extractedBytes: number;
    signal?: AbortSignal;
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

    const source = await archive.openReadStreamPromise(entry);
    await pipeline(
      source,
      createWriteStream(destination, { flags: 'wx', mode: safeMode }),
      { signal: input.signal },
    );
    await chmod(destination, safeMode);
    extractedPaths.add(systemPath);
    return entry.uncompressedSize;
  }

  private async readEntry(archive: ZipFile, entry: Entry, maxBytes: number) {
    if (entry.uncompressedSize > maxBytes) {
      throw new Error(`GApps entry is too large: ${entry.fileName}`);
    }
    const stream = await archive.openReadStreamPromise(entry);
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
    if (normalized.includes('googleservicesframework')) return 2;
    return 3;
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
