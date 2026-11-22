import { shellQuote } from '../../../common/shell-quote';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { Readable } from 'node:stream';
import { type MultipartUploadRequest } from '../../../common/http-upload';
import {
  DOCKER_CONTAINER_ARCHIVE,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import type { AndroidApplication } from '../../android-application.entity';
import type { RunningAndroidApplication } from '../../common/utils/running-application';
import { AndroidAppsQueryService } from '../../common/services/android-apps-query.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import {
  normalizeDataPath,
  normalizeEntryName,
  normalizeEntryPath,
} from '../utils/runtime-file-path';
import { RuntimeFilePreviewService } from './runtime-file-preview.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';
import { readRuntimeDownload } from '../utils/runtime-download-limit';
import {
  runtimeFileEntry,
  uploadedRuntimeFile,
} from '../utils/android-apps-runtime-file.utils';

const requireNewUploadTarget = [
  '[ ! -L "$target" ] || exit 43',
  '[ ! -f "$target" ] || exit 46',
  '[ ! -e "$target" ] || exit 43',
];
const requireReplaceableTarget =
  '[ ! -L "$target" ] && { [ ! -e "$target" ] || [ -f "$target" ]; } || exit 43';

const previewRuntimeKey = (app: AndroidApplication) =>
  JSON.stringify([
    app.ownerUserId,
    app.containerId,
    app.lastStartedAt,
    app.profileMode,
    app.profileName,
  ]);

@Injectable()
export class RuntimeDataFilesService {
  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly uploads: RuntimeUploadStreamService,
    private readonly previews: RuntimeFilePreviewService,
    private readonly queries: AndroidAppsQueryService,
  ) {}

  async listFiles(id: string, requestedPath?: string) {
    const app = await this.reconciler.requireRunningById(id);
    const directory = normalizeDataPath(requestedPath);
    const stdout = await this.runDataCommand(app, [
      `candidate=${shellQuote(directory)}`,
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
        return runtimeFileEntry(
          name,
          posix.join(directory, name),
          type === 'directory' ? 'directory' : 'file',
          Number(value) || 0,
          Number(modified),
        );
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
    return this.uploads.consumeFileUpload(id, request, async () => {
      const app = await this.reconciler.requireRunningById(id);
      const directory = normalizeDataPath(requestedPath);
      return (stream, name) =>
        this.storeRunningFileStream(app, stream, name, directory, overwrite);
    });
  }

  async createDirectory(
    id: string,
    requestedParentPath: string,
    value: string,
  ) {
    const app = await this.reconciler.requireRunningById(id);
    const parentPath = normalizeDataPath(requestedParentPath);
    const name = normalizeEntryName(value);
    const path = posix.join(parentPath, name);
    await this.runDataCommand(app, [
      `candidate=${shellQuote(parentPath)}`,
      `name=${shellQuote(name)}`,
      '[ -L "$candidate" ] && exit 41',
      'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('parent'),
      '[ -d "$parent" ] || exit 44',
      'target="$parent/$name"',
      '[ ! -e "$target" ] && [ ! -L "$target" ] || exit 43',
      'mkdir "$target"',
    ]);
    return runtimeFileEntry(name, path, 'directory', null);
  }

  async renameFile(id: string, requestedPath: string, value: string) {
    const app = await this.reconciler.requireRunningById(id);
    const path = normalizeEntryPath(requestedPath);
    const name = normalizeEntryName(value);
    const destinationPath = posix.join(posix.dirname(path), name);
    const stdout = await this.runDataCommand(app, [
      `candidate=${shellQuote(path)}`,
      `name=${shellQuote(name)}`,
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
    ]).finally(() => this.previews.invalidate(app.containerId));
    const [type = 'file', modified = '0', size = '0'] = stdout.split('\t');
    return runtimeFileEntry(
      name,
      destinationPath,
      type === 'directory' ? 'directory' : 'file',
      Number(size) || 0,
      Number(modified) || 0,
    );
  }

  async deleteFile(id: string, requestedPath: string) {
    const app = await this.reconciler.requireRunningById(id);
    const path = normalizeEntryPath(requestedPath);
    const stdout = await this.runDataCommand(app, [
      `candidate=${shellQuote(path)}`,
      '[ -L "$candidate" ] && exit 41',
      'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('source'),
      '[ "$source" != "/data" ] || exit 41',
      'if [ -d "$source" ]; then type=directory; else [ -f "$source" ] || exit 44; type=file; fi',
      'rm -rf "$source"',
      'printf "%s" "$type"',
    ]).finally(() => this.previews.invalidate(app.containerId));
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
    const app = await this.reconciler.requireRunningById(id);
    const path = normalizeEntryPath(requestedPath);
    const runtime = previewRuntimeKey(app);
    const resolveFile = () => this.resolvePreviewFile(app, path);
    const file = await resolveFile();
    const content = await this.previews.read(
      app.containerId,
      runtime,
      file,
      resolveFile,
    );
    const current = await this.queries.getStored(id);
    if (
      current.status !== AndroidApplicationStatus.Running ||
      previewRuntimeKey(current) !== runtime
    ) {
      throw new ConflictException(
        'Android runtime changed while preparing its preview.',
      );
    }
    return { content, mimeType: 'image/webp' };
  }

  private async resolvePreviewFile(
    app: RunningAndroidApplication,
    path: string,
  ) {
    const resolvedFile = await this.runDataCommand(app, [
      `candidate=${shellQuote(path)}`,
      '[ -L "$candidate" ] && exit 41',
      'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('source'),
      '[ -f "$source" ] || exit 44',
      'version=$(stat -c "%d|%i|%s|%y|%z" "$source" 2>/dev/null || true)',
      'printf "%s\t%s" "$source" "$version"',
    ]);
    const separator = resolvedFile.lastIndexOf('\t');
    if (separator < 0)
      throw new ConflictException('Runtime image metadata could not be read.');
    const version = resolvedFile.slice(separator + 1);
    const fields = version.split('|');
    // A coarse or unsupported change timestamp cannot distinguish same-second rewrites.
    const precise =
      fields.length === 5 &&
      fields.slice(0, 3).every((field) => /^\d+$/.test(field)) &&
      /\d{2}:\d{2}:\d{2}\.\d+/.test(fields[3]) &&
      /\d{2}:\d{2}:\d{2}\.\d*[1-9]/.test(fields[4]);
    return {
      path: resolvedFile.slice(0, separator),
      version: precise ? version : null,
    };
  }

  async downloadRuntimeFile(id: string, requestedPath?: string) {
    const app = await this.reconciler.requireRunningById(id);
    const filePath = normalizeEntryPath(requestedPath);
    const resolvedPath = (
      await this.runDataCommand(app, [
        `candidate=${shellQuote(filePath)}`,
        '[ -L "$candidate" ] && exit 41',
        'source=$(realpath "$candidate" 2>/dev/null) || exit 40',
        this.dataContainmentCheck('source'),
        '[ -f "$source" ] || exit 44',
        'printf "%s" "$source"',
      ])
    ).trim();
    const content = await readRuntimeDownload(
      this.archive,
      app.containerId,
      resolvedPath,
    );

    return {
      name: posix.basename(filePath),
      mimeType: 'application/octet-stream',
      dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
    };
  }

  private async storeRunningFileStream(
    app: RunningAndroidApplication,
    stream: Readable,
    originalName: string,
    directory: string,
    overwrite: boolean,
  ): Promise<ApplicationRuntimeFileUploadDto> {
    const fileName = normalizeEntryName(originalName);
    const resolvedDirectory = (
      await this.runDataCommand(app, [
        `candidate=${shellQuote(directory)}`,
        `name=${shellQuote(fileName)}`,
        '[ -L "$candidate" ] && exit 41',
        'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
        this.dataContainmentCheck('parent'),
        '[ -d "$parent" ] || exit 44',
        'target="$parent/$name"',
        ...(overwrite ? [requireReplaceableTarget] : requireNewUploadTarget),
        'printf "%s" "$parent"',
      ])
    ).trim();
    const sizeBytes = await this.uploads.withStagedFile(
      stream,
      async (tempPath) => {
        const stagingName = `.rebroid-upload-${randomUUID()}`;
        const stagingDirectory = await this.createUploadStagingDirectory(
          app,
          resolvedDirectory,
          stagingName,
        );
        try {
          await this.archive.copyFileToContainer(
            app.containerId,
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
          ).finally(() => this.previews.invalidate(app.containerId));
        } finally {
          await this.removeUploadStagingDirectory(
            app,
            resolvedDirectory,
            stagingName,
          );
        }
      },
    );

    return uploadedRuntimeFile(directory, fileName, sizeBytes);
  }

  private async createUploadStagingDirectory(
    app: RunningAndroidApplication,
    directory: string,
    stagingName: string,
  ) {
    await this.runDataCommand(app, [
      ...this.uploadStagingPreamble(directory, stagingName),
      '[ ! -e "$staging_dir" ] && [ ! -L "$staging_dir" ] || exit 43',
      'mkdir -m 700 "$staging_dir" || exit 45',
    ]);
    return posix.join(directory, stagingName);
  }

  private async finalizeStagedUpload(
    app: RunningAndroidApplication,
    directory: string,
    stagingName: string,
    fileName: string,
    overwrite: boolean,
  ) {
    await this.runDataCommand(app, [
      ...this.uploadStagingPreamble(directory, stagingName),
      `name=${shellQuote(fileName)}`,
      '[ -d "$staging_dir" ] && [ ! -L "$staging_dir" ] || exit 44',
      'staged="$staging_dir/$name"',
      '[ -f "$staged" ] && [ ! -L "$staged" ] || exit 44',
      'target="$parent/$name"',
      'trap \'rm -rf "$staging_dir"\' EXIT',
      ...(overwrite
        ? [requireReplaceableTarget, 'mv -f "$staged" "$parent" || exit 45']
        : [
            'if ! ln "$staged" "$parent" 2>/dev/null; then',
            ...requireNewUploadTarget,
            '  exit 45',
            'fi',
          ]),
      'rm -rf "$staging_dir" || exit 45',
      'trap - EXIT',
    ]);
  }

  private async removeUploadStagingDirectory(
    app: RunningAndroidApplication,
    directory: string,
    stagingName: string,
  ) {
    await this.runDataCommand(app, [
      ...this.uploadStagingPreamble(directory, stagingName),
      'rm -rf "$staging_dir"',
    ]).catch(() => undefined);
  }

  private uploadStagingPreamble(directory: string, stagingName: string) {
    return [
      `candidate=${shellQuote(directory)}`,
      `staging_name=${shellQuote(stagingName)}`,
      '[ -L "$candidate" ] && exit 41',
      'parent=$(realpath "$candidate" 2>/dev/null) || exit 40',
      this.dataContainmentCheck('parent'),
      '[ -d "$parent" ] || exit 44',
      'staging_dir="$parent/$staging_name"',
    ];
  }

  private dataContainmentCheck(variable: string) {
    return `case "$${variable}" in /data|/data/*) ;; *) exit 41 ;; esac`;
  }

  private async runDataCommand(
    app: RunningAndroidApplication,
    lines: string[],
  ) {
    try {
      const { stdout } = await this.exec.execInContainerWithOutput(
        app.containerId,
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
      if (error.details.exitCode === 46) {
        throw new ConflictException({
          code: 'runtime_file_exists',
          message: 'A file with that name already exists.',
          statusCode: 409,
        });
      }
      if (error.details.exitCode === 44) {
        throw new ConflictException(
          'Runtime file or directory type is invalid.',
        );
      }
      throw error;
    }
  }
}
