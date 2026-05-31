import { ConflictException, Injectable } from '@nestjs/common';
import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { Readable, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request } from 'express';
import { ApplicationProfileMode } from '../../application-profile-mode';
import { DockerContainerArchiveService } from '../../../docker/containers/services/docker-container-archive.service';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { DockerResourceRuntimeService } from '../../../docker/resources/services/docker-resource-runtime.service';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import {
  parseDownloadFiles,
  sanitizeRuntimeFileName,
} from '../utils/android-apps-runtime-file.utils';

@Injectable()
export class AndroidAppsRuntimeAccessService {
  private readonly dataDirectory = '/data';
  private readonly downloadDirectory = '/data/media/0/Download';
  private readonly maxUploadBytes = 256 * 1024 * 1024;

  constructor(
    private readonly archive: DockerContainerArchiveService,
    private readonly exec: DockerContainerExecService,
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly networkIsolation: NetworkIsolationService,
    private readonly resources: DockerResourceRuntimeService,
    private readonly logs: AndroidAppsLogService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
    private readonly sidecarAdb: AndroidAppsSidecarAdbService,
    private readonly state: AndroidAppsStateService,
  ) {}

  /** Reads recent Android notifications. */
  async notifications(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return [];
    }

    return this.sidecarAdb.notifications(app);
  }

  /** Reads recent logs from the app container. */
  async containerLogs(id: string, tail = 300) {
    const app = await this.state.get(id);
    if (!app.containerId) {
      return {
        source: 'container' as const,
        collectedAt: new Date().toISOString(),
        output: 'No container has been created for this application yet.',
      };
    }

    const runtimeState = await this.lifecycle.getContainerRuntimeState(
      app.containerId,
    );
    if (!runtimeState.exists) {
      return {
        source: 'container' as const,
        collectedAt: new Date().toISOString(),
        output:
          app.status === AndroidApplicationStatus.Stopped
            ? 'Container logs are unavailable because the runtime container is currently stopped and has already been removed.'
            : 'Container logs are unavailable because the runtime container no longer exists.',
      };
    }

    return {
      source: 'container' as const,
      collectedAt: new Date().toISOString(),
      output: await this.lifecycle.getContainerLogs(app.containerId, tail),
    };
  }

  /** Reads recent logs from the orchestrator side. */
  async eventLogs(id: string, tail = 300) {
    await this.state.get(id);
    return {
      source: 'orchestrator' as const,
      collectedAt: new Date().toISOString(),
      output: await this.logs.read(id, tail),
    };
  }

  /** Reads recent ADB logs from the display sidecar. */
  async adbLogs(id: string, tail = 300) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return {
        source: 'adb' as const,
        collectedAt: new Date().toISOString(),
        output:
          'ADB logs are available after the Android container is running.',
      };
    }

    return this.sidecarAdb.logcat(app, tail);
  }

  /** Lists files and directories in the active runtime data volume. */
  async listFiles(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const directory = this.normalizeDataPath(requestedPath);
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          `dir=${this.shellQuote(directory)}`,
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
        const [type, name = '', modified = '', value = '0'] =
          line.split('\t');
        const modifiedSeconds = Number(modified);
        const numericValue = Number(value) || 0;
        return {
          name,
          path: posix.join(directory, name),
          type: type === 'directory' ? ('directory' as const) : ('file' as const),
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

  /** Uploads one file into a directory in the active runtime data volume. */
  async uploadFile(id: string, request: Request, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const directory = this.normalizeDataPath(requestedPath);
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `test -d ${this.shellQuote(directory)}`,
    ]);
    return this.consumeFileUpload(request, (stream, originalName) =>
      this.storeRunningFileStream(app, stream, originalName, directory),
    );
  }

  /** Downloads one file from the active runtime data volume. */
  async downloadRuntimeFile(id: string, requestedPath?: string) {
    const app = await this.getRunningRuntimeApp(id);
    const filePath = this.normalizeDataPath(requestedPath);
    if (filePath === this.dataDirectory) {
      throw new ConflictException('A file path is required.');
    }
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `test -f ${this.shellQuote(filePath)}`,
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

  /** Lists files in the Android Download folder. */
  async listDownloadFiles(
    id: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.state.get(id);
    if (this.shouldUseRunningContainer(app, query)) {
      return this.listRunningDownloadFiles(app);
    }

    const directory = await this.getPersistentDownloadDirectory(app, query);
    if (!directory) {
      return [];
    }

    return this.listVolumeDownloadFiles(directory);
  }

  private async listRunningDownloadFiles(app: AndroidApplication) {
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          `dir="${this.downloadDirectory}"`,
          'mkdir -p "$dir"',
          'find "$dir" -maxdepth 1 -type f -print 2>/dev/null | while IFS= read -r file; do',
          'name=${file##*/}',
          'size=$(stat -c %s "$file" 2>/dev/null || wc -c < "$file" 2>/dev/null || echo 0)',
          'modified=$(stat -c %Y "$file" 2>/dev/null || echo 0)',
          'printf "%s\\t%s\\t%s\\n" "$name" "$size" "$modified"',
          'done',
        ].join('\n'),
      ],
    );

    return parseDownloadFiles(stdout, this.downloadDirectory);
  }

  /** Uploads one file into the Download folder. */
  async uploadDownloadFile(
    id: string,
    request: Request,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.state.get(id);
    return this.consumeDownloadFileUpload(app, request, query);
  }

  async uploadDownloadFileBuffer(
    app: AndroidApplication,
    file?: Express.Multer.File,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    if (!file) {
      throw new ConflictException('A file upload is required.');
    }

    const fileName = sanitizeRuntimeFileName(file.originalname);
    if (!this.shouldUseRunningContainer(app, query)) {
      const directory = await this.getPersistentDownloadDirectory(app, query, {
        create: true,
      });
      if (!directory) {
        throw new ConflictException(
          'Temporary profiles can only transfer files while the app is running.',
        );
      }

      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, fileName), file.buffer, { mode: 0o644 });
      return {
        uploaded: true,
        name: fileName,
        path: `${this.downloadDirectory}/${fileName}`,
        type: 'file' as const,
        sizeBytes: file.size,
        itemCount: null,
        modifiedAt: new Date().toISOString(),
      };
    }

    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `mkdir -p ${this.shellQuote(this.downloadDirectory)}`,
    ]);
    await this.archive.copyBufferToContainer(
      app.containerId!,
      file.buffer,
      this.downloadDirectory,
      fileName,
    );
    await this.prepareRunningDownloadFile(app, fileName);
    void this.scanRunningDownloadFile(app, fileName).catch((error) => {
      void this.logs.append(app.id, 'Uploaded file media scan failed', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      uploaded: true,
      name: fileName,
      path: `${this.downloadDirectory}/${fileName}`,
      type: 'file' as const,
      sizeBytes: file.size,
      itemCount: null,
      modifiedAt: new Date().toISOString(),
    };
  }

  private async consumeDownloadFileUpload(
    app: AndroidApplication,
    request: Request,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    return this.consumeFileUpload(request, (stream, originalName) =>
      this.storeDownloadFileStream(app, stream, originalName, query),
    );
  }

  private async consumeFileUpload(
    request: Request,
    store: (
      stream: Readable,
      originalName: string,
    ) => Promise<ApplicationRuntimeFileUploadDto>,
  ) {
    if (!request.is('multipart/form-data')) {
      throw new ConflictException('A multipart file upload is required.');
    }

    const parser = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: this.maxUploadBytes,
      },
    });

    return new Promise<ApplicationRuntimeFileUploadDto>((resolve, reject) => {
      let upload: Promise<ApplicationRuntimeFileUploadDto> | null = null;
      let settled = false;

      const finish = (callback: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        callback();
      };

      const fail = (error: unknown) => {
        finish(() => {
          reject(error);
        });
      };

      parser.on('file', (fieldName, stream, info) => {
        if (fieldName !== 'file' || upload) {
          stream.resume();
          return;
        }

        stream.on('limit', () => {
          fail(
            new ConflictException(
              `File upload exceeds the ${this.maxUploadBytes / 1024 / 1024} MB limit.`,
            ),
          );
        });

        upload = store(stream, info.filename || 'upload');
        upload.catch(fail);
      });

      parser.on('error', fail);
      request.on('aborted', () => {
        fail(new ConflictException('File upload was cancelled.'));
      });
      request.on('error', fail);
      parser.on('finish', () => {
        if (!upload) {
          fail(new ConflictException('A file upload is required.'));
          return;
        }

        upload.then((result) => {
          finish(() => {
            resolve(result);
          });
        }, fail);
      });

      request.pipe(parser);
    });
  }

  private async storeDownloadFileStream(
    app: AndroidApplication,
    stream: Readable,
    originalName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const fileName = sanitizeRuntimeFileName(originalName);
    if (!this.shouldUseRunningContainer(app, query)) {
      return this.storePersistentDownloadFileStream(
        app,
        stream,
        fileName,
        query,
      );
    }

    return this.storeRunningDownloadFileStream(app, stream, fileName);
  }

  private async storePersistentDownloadFileStream(
    app: AndroidApplication,
    stream: Readable,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const directory = await this.getPersistentDownloadDirectory(app, query, {
      create: true,
    });
    if (!directory) {
      stream.resume();
      throw new ConflictException(
        'Temporary profiles can only transfer files while the app is running.',
      );
    }

    await mkdir(directory, { recursive: true });
    const targetPath = join(directory, fileName);
    let sizeBytes = 0;
    const counter = this.createByteCounter((bytes) => {
      sizeBytes += bytes;
    }, this.maxUploadBytes);

    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(targetPath, { mode: 0o644 }),
      );
    } catch (error) {
      await unlink(targetPath).catch(() => undefined);
      throw error;
    }

    return {
      uploaded: true,
      name: fileName,
      path: `${this.downloadDirectory}/${fileName}`,
      type: 'file' as const,
      sizeBytes,
      itemCount: null,
      modifiedAt: new Date().toISOString(),
    };
  }

  private async storeRunningDownloadFileStream(
    app: AndroidApplication,
    stream: Readable,
    fileName: string,
  ) {
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `mkdir -p ${this.shellQuote(this.downloadDirectory)}`,
    ]);

    const tempDir = await mkdtemp(join(tmpdir(), 'rebroid-download-upload-'));
    const tempPath = join(tempDir, fileName);
    let sizeBytes = 0;
    const counter = this.createByteCounter((bytes) => {
      sizeBytes += bytes;
    }, this.maxUploadBytes);

    try {
      await pipeline(
        stream,
        counter,
        createWriteStream(tempPath, { mode: 0o600 }),
      );
      await this.archive.copyFileToContainer(
        app.containerId!,
        tempPath,
        this.downloadDirectory,
        fileName,
      );
      await this.prepareRunningDownloadFile(app, fileName);
      void this.scanRunningDownloadFile(app, fileName).catch((error) => {
        void this.logs.append(app.id, 'Uploaded file media scan failed', {
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }

    return {
      uploaded: true,
      name: fileName,
      path: `${this.downloadDirectory}/${fileName}`,
      type: 'file' as const,
      sizeBytes,
      itemCount: null,
      modifiedAt: new Date().toISOString(),
    };
  }

  private async storeRunningFileStream(
    app: AndroidApplication,
    stream: Readable,
    originalName: string,
    directory: string,
  ) {
    const fileName = sanitizeRuntimeFileName(originalName);
    const tempDir = await mkdtemp(join(tmpdir(), 'rebroid-runtime-upload-'));
    const tempPath = join(tempDir, fileName);
    let sizeBytes = 0;
    const counter = this.createByteCounter((bytes) => {
      sizeBytes += bytes;
    }, this.maxUploadBytes);

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
      type: 'file' as const,
      sizeBytes,
      itemCount: null,
      modifiedAt: new Date().toISOString(),
    };
  }

  private createByteCounter(
    onBytes: (bytes: number) => void,
    maxBytes: number,
  ) {
    let totalBytes = 0;
    return new Transform({
      transform(
        chunk: Buffer,
        _encoding: BufferEncoding,
        callback: TransformCallback,
      ) {
        const bytes = Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(chunk);
        totalBytes += bytes;
        if (totalBytes > maxBytes) {
          callback(
            new ConflictException(
              `File upload exceeds the ${maxBytes / 1024 / 1024} MB limit.`,
            ),
          );
          return;
        }
        onBytes(bytes);
        callback(null, chunk);
      },
    });
  }

  /** Downloads one file from the Download folder. */
  async downloadFile(
    id: string,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.state.get(id);
    const safeFileName = sanitizeRuntimeFileName(fileName);
    if (!this.shouldUseRunningContainer(app, query)) {
      const directory = await this.getPersistentDownloadDirectory(app, query);
      if (!directory) {
        throw new ConflictException(
          'Temporary profiles can only transfer files while the app is running.',
        );
      }

      const content = await readFile(join(directory, safeFileName));
      return {
        name: safeFileName,
        mimeType: 'application/octet-stream',
        dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
      };
    }

    const content = await this.archive.readFileFromContainer(
      app.containerId!,
      `${this.downloadDirectory}/${safeFileName}`,
    );

    return {
      name: safeFileName,
      mimeType: 'application/octet-stream',
      dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
    };
  }

  /** Reads the Android clipboard. */
  async getClipboard(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const clipboard = await this.sidecarAdb.getClipboard(app);

    return {
      text: clipboard.text,
      supported: clipboard.supported,
      message: clipboard.supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  /** Writes text to the Android clipboard. */
  async setClipboard(id: string, text: string) {
    const app = await this.getRunningRuntimeApp(id);
    const clipboard = await this.displaySidecar
      .setClipboard(app, text)
      .catch(() => this.sidecarAdb.setClipboard(app, text));

    return {
      text: clipboard.text,
      supported: clipboard.supported,
      message: clipboard.supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  /** Captures a screenshot from the running app. */
  async screenshot(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    return this.sidecarAdb.screenshot(app);
  }

  /** Loads one running app for runtime actions. */
  private async getRunningRuntimeApp(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      throw new ConflictException(
        'Application must be running before using viewer runtime tools.',
      );
    }

    return app;
  }

  private shouldUseRunningContainer(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const profileMode = query.profileMode ?? app.profileMode;
    const profileName =
      query.profileName?.trim() || app.profileName || 'default';

    return (
      app.containerId &&
      app.status === AndroidApplicationStatus.Running &&
      profileMode === app.profileMode &&
      profileName === (app.profileName || 'default')
    );
  }

  private async prepareRunningDownloadFile(
    app: AndroidApplication,
    fileName: string,
  ) {
    const filePath = `${this.downloadDirectory}/${fileName}`;

    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      [
        `file_path=${this.shellQuote(filePath)}`,
        'chown 1023:1023 "$file_path" 2>/dev/null || true',
        'chmod 0644 "$file_path" 2>/dev/null || true',
        'sync "$file_path" 2>/dev/null || sync',
      ].join('\n'),
    ]);
  }

  private async scanRunningDownloadFile(
    app: AndroidApplication,
    fileName: string,
  ) {
    const filePath = `${this.downloadDirectory}/${fileName}`;
    const publicPath = `/sdcard/Download/${fileName}`;

    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      [
        `file_path=${this.shellQuote(filePath)}`,
        `public_path=${this.shellQuote(publicPath)}`,
        'run_with_timeout() {',
        '  timeout_seconds="$1"',
        '  shift',
        '  "$@" &',
        '  pid=$!',
        '  elapsed=0',
        '  while kill -0 "$pid" 2>/dev/null; do',
        '    if [ "$elapsed" -ge "$timeout_seconds" ]; then',
        '      kill "$pid" 2>/dev/null || true',
        '      wait "$pid" 2>/dev/null || true',
        '      return 124',
        '    fi',
        '    sleep 1',
        '    elapsed=$((elapsed + 1))',
        '  done',
        '  wait "$pid"',
        '}',
        'scan_file() {',
        '  cmd media scan-file "$file_path" >/dev/null 2>&1 || true',
        '  am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://${public_path}" >/dev/null 2>&1 || true',
        '}',
        'run_with_timeout 20 scan_file || true',
      ].join('\n'),
    ]);
  }

  private async getPersistentDownloadDirectory(
    app: AndroidApplication,
    query: ApplicationRuntimeFilesQueryDto,
    options: { create?: boolean } = {},
  ) {
    const profileMode = query.profileMode ?? app.profileMode;
    if (profileMode !== ApplicationProfileMode.Persistent) {
      return null;
    }

    const profileName =
      query.profileName?.trim() || app.profileName || 'default';
    const volumeName = this.networkIsolation.namesFor(
      app.id,
      app.name,
      profileName,
    ).volumeName;

    if (options.create) {
      await this.resources.createVolume(app.id, volumeName);
    }

    const volume = await this.resources.inspectVolume(volumeName);
    if (!volume?.Mountpoint) {
      return null;
    }

    return join(volume.Mountpoint, 'media', '0', 'Download');
  }

  private async listVolumeDownloadFiles(directory: string) {
    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch {
      return [];
    }

    const files = await Promise.all(
      entries.map(async (name) => {
        const safeName = sanitizeRuntimeFileName(name);
        const path = join(directory, safeName);
        const fileStat = await stat(path).catch(() => null);
        if (!fileStat?.isFile()) {
          return null;
        }

        return {
          name: safeName,
          path: `${this.downloadDirectory}/${safeName}`,
          type: 'file' as const,
          sizeBytes: fileStat.size,
          itemCount: null,
          modifiedAt: fileStat.mtime.toISOString(),
        };
      }),
    );

    return files
      .filter((file): file is NonNullable<typeof file> => Boolean(file))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }

  private normalizeDataPath(requestedPath?: string) {
    const normalized = posix.normalize(requestedPath?.trim() || this.dataDirectory);
    if (
      normalized.includes('\0') ||
      !normalized.startsWith(`${this.dataDirectory}/`) &&
      normalized !== this.dataDirectory
    ) {
      throw new ConflictException('Path must be inside the runtime data volume.');
    }
    return normalized;
  }
}
