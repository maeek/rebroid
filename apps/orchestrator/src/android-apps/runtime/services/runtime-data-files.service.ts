import { Inject, ConflictException, Injectable } from '@nestjs/common';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { type MultipartUploadRequest } from '../../../common/http-upload';
import {
  DOCKER_CONTAINER_ARCHIVE,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import { AndroidApplicationStatus } from '../../contracts/android-application-status';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

@Injectable()
export class RuntimeDataFilesService {
  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    private readonly state: AndroidAppsStateService,
    private readonly paths: RuntimeFilePathService,
    private readonly uploads: RuntimeUploadStreamService,
  ) {}

  async listFiles(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const directory = this.paths.normalizeDataPath(requestedPath);
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          `dir=${this.paths.shellQuote(directory)}`,
          '[ -d "$dir" ] || exit 2',
          'find "$dir" -mindepth 1 -maxdepth 1 -print 2>/dev/null | while IFS= read -r entry; do',
          'name=${entry##*/}',
          'modified=$(stat -c %Y "$entry" 2>/dev/null || echo 0)',
          'if [ -d "$entry" ]; then',
          '  count=$(find "$entry" -mindepth 1 -maxdepth 1 -print 2>/dev/null | wc -l | tr -d " ")',
          '  printf "directory\\t%s\\t%s\\t%s\\n" "$name" "$modified" "$count"',
          'elif [ -f "$entry" ]; then',
          '  size=$(stat -c %s "$entry" 2>/dev/null || wc -c < "$entry" 2>/dev/null || echo 0)',
          '  printf "file\\t%s\\t%s\\t%s\\n" "$name" "$modified" "$size"',
          'fi',
          'done',
        ].join('\n'),
      ],
    );

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
          itemCount: type === 'directory' ? numericValue : null,
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
  ) {
    const app = await this.getRunningRuntimeApp(id);
    const directory = this.paths.normalizeDataPath(requestedPath);
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `test -d ${this.paths.shellQuote(directory)}`,
    ]);
    return this.uploads.consumeFileUpload(request, (stream, originalName) =>
      this.storeRunningFileStream(app, stream, originalName, directory),
    );
  }

  async downloadRuntimeFile(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const filePath = this.paths.normalizeDataPath(requestedPath);
    if (filePath === this.paths.dataDirectory) {
      throw new ConflictException('A file path is required.');
    }
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `test -f ${this.paths.shellQuote(filePath)}`,
    ]);
    const content = await this.archive.readFileFromContainer(
      app.containerId!,
      filePath,
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
  ): Promise<ApplicationRuntimeFileUploadDto> {
    const fileName = this.paths.sanitizeFileName(originalName);
    const tempDir = await mkdtemp(join(tmpdir(), 'rebroid-runtime-upload-'));
    const tempPath = join(tempDir, fileName);
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
      await this.archive.copyFileToContainer(
        app.containerId!,
        tempPath,
        directory,
        fileName,
      );
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

  private async getRunningRuntimeApp(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }
}
