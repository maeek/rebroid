import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { type MultipartUploadRequest } from '../../../common/http-upload';
import {
  DOCKER_CONTAINER_ARCHIVE,
  DockerContainerArchiveReadLimitError,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

const maximumPreviewSourceBytes = 25 * 1024 * 1024;
const maximumPreviewCacheEntries = 64;
const supportedPreviewFormats = new Set(['gif', 'jpeg', 'png', 'webp']);

type RuntimeEntryType = 'file' | 'directory';

@Injectable()
export class RuntimeDataFilesService {
  private readonly previewCache = new Map<string, Buffer>();

  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly paths: RuntimeFilePathService,
    private readonly uploads: RuntimeUploadStreamService,
  ) {}

  async listFiles(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const directory = this.paths.normalizeDataPath(requestedPath);
    const stdout = await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(directory)}`,
      '[ -L "$candidate" ] && exit 41',
      'dir=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('dir'),
      '[ -d "$dir" ] || exit 44',
      'find "$dir" -mindepth 1 -maxdepth 1 -print 2>/dev/null | while IFS= read -r entry; do',
      'name=${entry##*/}',
      'modified=$(stat -c %Y "$entry" 2>/dev/null || echo 0)',
      'if [ -d "$entry" ] && [ ! -L "$entry" ]; then',
      '  printf "directory\\t%s\\t%s\\t0\\n" "$name" "$modified"',
      'elif [ -f "$entry" ] && [ ! -L "$entry" ]; then',
      '  size=$(stat -c %s "$entry" 2>/dev/null || wc -c < "$entry" 2>/dev/null || echo 0)',
      '  printf "file\\t%s\\t%s\\t%s\\n" "$name" "$modified" "$size"',
      'fi',
      'done',
    ]);

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [type, name = '', modified = '', value = '0'] = line.split('\t');
        const modifiedSeconds = Number(modified);
        const numericValue = Number(value) || 0;
        return {
          name,
          path: posix.join(directory, name),
          type:
            type === 'directory' ? ('directory' as const) : ('file' as const),
          sizeBytes: type === 'directory' ? null : numericValue,
          itemCount: null,
          modifiedAt:
            Number.isFinite(modifiedSeconds) && modifiedSeconds > 0
              ? new Date(modifiedSeconds * 1000).toISOString()
              : null,
        };
      })
      .filter((entry) => entry.name.length > 0)
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'directory' ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  }

  async uploadFile(
    id: string,
    request: MultipartUploadRequest,
    requestedPath?: string,
    overwrite = false,
  ) {
    const app = await this.getRunningRuntimeApp(id);
    const directory = this.paths.normalizeDataPath(requestedPath);
    return this.uploads.consumeFileUpload(request, (stream, originalName) =>
      this.storeRunningFileStream(
        app,
        stream,
        originalName,
        directory,
        overwrite,
      ),
    );
  }

  async createDirectory(
    id: string,
    requestedParentPath: string,
    value: string,
  ) {
    const app = await this.getRunningRuntimeApp(id);
    const parentPath = this.paths.normalizeDataPath(requestedParentPath);
    const name = this.paths.normalizeEntryName(value);
    const path = posix.join(parentPath, name);
    await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(parentPath)}`,
      `name=${this.paths.shellQuote(name)}`,
      '[ -L "$candidate" ] && exit 41',
      'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('parent'),
      '[ -d "$parent" ] || exit 44',
      'target="$parent/$name"',
      '[ ! -e "$target" ] && [ ! -L "$target" ] || exit 43',
      'mkdir "$target"',
    ]);
    return this.runtimeEntry(name, path, 'directory', null);
  }

  async renameFile(id: string, requestedPath: string, value: string) {
    const app = await this.getRunningRuntimeApp(id);
    const path = this.paths.normalizeDataPath(requestedPath);
    this.paths.assertMutablePath(path);
    const name = this.paths.normalizeEntryName(value);
    const destinationPath = posix.join(posix.dirname(path), name);
    const stdout = await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(path)}`,
      `name=${this.paths.shellQuote(name)}`,
      '[ -L "$candidate" ] && exit 41',
      'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('source'),
      '[ "$source" != "/data" ] || exit 41',
      'parent=${source%/*}',
      'target="$parent/$name"',
      '[ ! -e "$target" ] && [ ! -L "$target" ] || exit 43',
      'if [ -d "$source" ]; then type=directory; else [ -f "$source" ] || exit 44; type=file; fi',
      'mv "$source" "$target"',
      'modified=$(stat -c %Y "$target" 2>/dev/null || echo 0)',
      'if [ "$type" = file ]; then size=$(stat -c %s "$target" 2>/dev/null || echo 0); else size=0; fi',
      'printf "%s\\t%s\\t%s" "$type" "$modified" "$size"',
    ]);
    const [type = 'file', modified = '0', size = '0'] = stdout.split('\t');
    return this.runtimeEntry(
      name,
      destinationPath,
      type === 'directory' ? 'directory' : 'file',
      Number(size) || 0,
      Number(modified) || 0,
    );
  }

  async deleteFile(id: string, requestedPath: string) {
    const app = await this.getRunningRuntimeApp(id);
    const path = this.paths.normalizeDataPath(requestedPath);
    this.paths.assertMutablePath(path);
    const stdout = await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(path)}`,
      '[ -L "$candidate" ] && exit 41',
      'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('source'),
      '[ "$source" != "/data" ] || exit 41',
      'if [ -d "$source" ]; then type=directory; else [ -f "$source" ] || exit 44; type=file; fi',
      'rm -rf "$source"',
      'printf "%s" "$type"',
    ]);
    return {
      deleted: true,
      path,
      type:
        stdout.trim() === 'directory'
          ? ('directory' as const)
          : ('file' as const),
    };
  }

  async previewFile(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const path = this.paths.normalizeDataPath(requestedPath);
    this.paths.assertMutablePath(path);
    const resolvedFile = (
      await this.runDataCommand(app, [
        `candidate=${this.paths.shellQuote(path)}`,
        '[ -L "$candidate" ] && exit 41',
        'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
        this.dataContainmentCheck('source'),
        '[ -f "$source" ] || exit 44',
        'modified=$(stat -c %Y "$source" 2>/dev/null || echo 0)',
        'printf "%s\t%s" "$source" "$modified"',
      ])
    ).trim();
    const separator = resolvedFile.lastIndexOf('\t');
    const resolvedPath = resolvedFile.slice(0, separator);
    const modified = resolvedFile.slice(separator + 1);
    const cacheKey = `${app.containerId}:${resolvedPath}:${modified}`;
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      this.previewCache.delete(cacheKey);
      this.previewCache.set(cacheKey, cached);
      return { content: cached, mimeType: 'image/webp' };
    }

    let source: Buffer;
    try {
      source = await this.archive.readFileFromContainer(
        app.containerId!,
        resolvedPath,
        { maximumBytes: maximumPreviewSourceBytes },
      );
    } catch (error) {
      if (error instanceof DockerContainerArchiveReadLimitError) {
        throw new PayloadTooLargeException(
          'Image previews are limited to 25 MiB source files.',
        );
      }
      throw error;
    }

    const image = sharp(source, {
      animated: false,
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata().catch(() => null);
    if (!metadata?.format || !supportedPreviewFormats.has(metadata.format)) {
      throw new UnsupportedMediaTypeException(
        'Only JPEG, PNG, WebP, and GIF images can be previewed.',
      );
    }
    const content = await image
      .rotate()
      .resize({
        width: 1280,
        height: 960,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    this.previewCache.set(cacheKey, content);
    while (this.previewCache.size > maximumPreviewCacheEntries) {
      const oldestKey = this.previewCache.keys().next().value;
      if (oldestKey === undefined) break;
      this.previewCache.delete(oldestKey);
    }
    return { content, mimeType: 'image/webp' };
  }

  async downloadRuntimeFile(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const filePath = this.paths.normalizeDataPath(requestedPath);
    this.paths.assertMutablePath(filePath);
    const resolvedPath = (
      await this.runDataCommand(app, [
        `candidate=${this.paths.shellQuote(filePath)}`,
        '[ -L "$candidate" ] && exit 41',
        'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
        this.dataContainmentCheck('source'),
        '[ -f "$source" ] || exit 44',
        'printf "%s" "$source"',
      ])
    ).trim();
    const content = await this.archive.readFileFromContainer(
      app.containerId!,
      resolvedPath,
    );

    return {
      name: posix.basename(filePath),
      mimeType: 'application/octet-stream',
      dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
    };
  }

  private async storeRunningFileStream(
    app: AndroidApplication,
    stream: Readable,
    originalName: string,
    directory: string,
    overwrite: boolean,
  ): Promise<ApplicationRuntimeFileUploadDto> {
    const fileName = this.paths.normalizeEntryName(originalName);
    const resolvedDirectory = (
      await this.runDataCommand(app, [
        `candidate=${this.paths.shellQuote(directory)}`,
        `name=${this.paths.shellQuote(fileName)}`,
        '[ -L "$candidate" ] && exit 41',
        'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
        this.dataContainmentCheck('parent'),
        '[ -d "$parent" ] || exit 44',
        'target="$parent/$name"',
        '[ ! -d "$target" ] || exit 43',
        ...(overwrite
          ? [
              '[ ! -e "$target" ] || { [ -f "$target" ] && [ ! -L "$target" ] || exit 43; }',
            ]
          : ['[ ! -e "$target" ] && [ ! -L "$target" ] || exit 43']),
        'printf "%s" "$parent"',
      ])
    ).trim();
    const tempDir = await mkdtemp(join(tmpdir(), 'rebroid-runtime-upload-'));
    const tempPath = join(tempDir, fileName);
    const stagingName = `.rebroid-upload-${randomUUID()}`;
    let sizeBytes = 0;
    const counter = this.uploads.createByteCounter((bytes) => {
      sizeBytes += bytes;
    });

    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(tempPath, { mode: 0o600 }),
      );
      const stagingDirectory = await this.createUploadStagingDirectory(
        app,
        resolvedDirectory,
        stagingName,
      );
      try {
        await this.archive.copyFileToContainer(
          app.containerId!,
          tempPath,
          stagingDirectory,
          fileName,
        );
        await this.finalizeStagedUpload(
          app,
          resolvedDirectory,
          stagingName,
          fileName,
          overwrite,
        );
      } finally {
        await this.removeUploadStagingDirectory(
          app,
          resolvedDirectory,
          stagingName,
        );
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }

    return {
      uploaded: true,
      name: fileName,
      path: posix.join(directory, fileName),
      type: 'file',
      sizeBytes,
      itemCount: null,
      modifiedAt: new Date().toISOString(),
    };
  }

  private async createUploadStagingDirectory(
    app: AndroidApplication,
    directory: string,
    stagingName: string,
  ) {
    await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(directory)}`,
      `staging_name=${this.paths.shellQuote(stagingName)}`,
      '[ -L "$candidate" ] && exit 41',
      'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('parent'),
      '[ -d "$parent" ] || exit 44',
      'staging_dir="$parent/$staging_name"',
      '[ ! -e "$staging_dir" ] && [ ! -L "$staging_dir" ] || exit 43',
      'mkdir -m 700 "$staging_dir" || exit 45',
    ]);
    return posix.join(directory, stagingName);
  }

  private async finalizeStagedUpload(
    app: AndroidApplication,
    directory: string,
    stagingName: string,
    fileName: string,
    overwrite: boolean,
  ) {
    await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(directory)}`,
      `staging_name=${this.paths.shellQuote(stagingName)}`,
      `name=${this.paths.shellQuote(fileName)}`,
      '[ -L "$candidate" ] && exit 41',
      'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('parent'),
      '[ -d "$parent" ] || exit 44',
      'staging_dir="$parent/$staging_name"',
      '[ -d "$staging_dir" ] && [ ! -L "$staging_dir" ] || exit 44',
      'staged="$staging_dir/$name"',
      '[ -f "$staged" ] && [ ! -L "$staged" ] || exit 44',
      'target="$parent/$name"',
      'trap \'rm -rf "$staging_dir"\' EXIT',
      ...(overwrite
        ? [
            '[ ! -e "$target" ] || { [ -f "$target" ] && [ ! -L "$target" ] || exit 43; }',
            'mv -f "$staged" "$parent" || exit 45',
          ]
        : [
            'if ! ln "$staged" "$parent" 2>/dev/null; then',
            '  if [ -e "$target" ] || [ -L "$target" ]; then exit 43; fi',
            '  exit 45',
            'fi',
          ]),
      'rm -rf "$staging_dir" || exit 45',
      'trap - EXIT',
    ]);
  }

  private async removeUploadStagingDirectory(
    app: AndroidApplication,
    directory: string,
    stagingName: string,
  ) {
    await this.runDataCommand(app, [
      `candidate=${this.paths.shellQuote(directory)}`,
      `staging_name=${this.paths.shellQuote(stagingName)}`,
      '[ -L "$candidate" ] && exit 41',
      'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('parent'),
      '[ -d "$parent" ] || exit 44',
      'staging_dir="$parent/$staging_name"',
      'rm -rf "$staging_dir"',
    ]).catch(() => undefined);
  }

  private dataContainmentCheck(variable: string) {
    return `case "$${variable}" in /data|/data/*) ;; *) exit 41 ;; esac`;
  }

  private async runDataCommand(app: AndroidApplication, lines: string[]) {
    try {
      const { stdout } = await this.exec.execInContainerWithOutput(
        app.containerId!,
        ['sh', '-lc', lines.join('\n')],
      );
      return stdout;
    } catch (error) {
      if (!(error instanceof ContainerCommandFailedException)) {
        throw error;
      }
      if (error.details.exitCode === 40) {
        throw new NotFoundException('Runtime file or directory was not found.');
      }
      if (error.details.exitCode === 41) {
        throw new ConflictException(
          'Runtime paths must resolve inside /data and cannot be symbolic links.',
        );
      }
      if (error.details.exitCode === 43) {
        throw new ConflictException(
          'A file or directory with that name already exists.',
        );
      }
      if (error.details.exitCode === 44) {
        throw new ConflictException(
          'Runtime file or directory type is invalid.',
        );
      }
      throw error;
    }
  }

  private runtimeEntry(
    name: string,
    path: string,
    type: RuntimeEntryType,
    sizeBytes: number | null,
    modifiedSeconds = Math.floor(Date.now() / 1000),
  ) {
    return {
      name,
      path,
      type,
      sizeBytes: type === 'file' ? sizeBytes : null,
      itemCount: null,
      modifiedAt:
        modifiedSeconds > 0
          ? new Date(modifiedSeconds * 1000).toISOString()
          : null,
    };
  }

  private async getRunningRuntimeApp(id: string) {
    const app = await this.reconciler.reconcileById(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }
}
