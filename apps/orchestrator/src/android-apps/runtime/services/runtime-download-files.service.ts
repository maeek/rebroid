import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { MultipartUploadRequest } from '../../../common/http-upload';
import {
  DOCKER_CONTAINER_ARCHIVE,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import { parseDownloadFiles } from '../utils/android-apps-runtime-file.utils';
import { readRuntimeDownload } from '../utils/runtime-download-limit';
import { RuntimeDownloadVolumeService } from './runtime-download-volume.service';
import { RuntimeFilePathService } from './runtime-file-path.service';
import { RuntimeUploadStreamService } from './runtime-upload-stream.service';

@Injectable()
export class RuntimeDownloadFilesService {
  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    private readonly logs: AndroidAppsLogService,
    private readonly reconciler: AndroidAppsRuntimeStateReconciler,
    private readonly paths: RuntimeFilePathService,
    private readonly volumes: RuntimeDownloadVolumeService,
    private readonly uploads: RuntimeUploadStreamService,
  ) {}

  async listDownloadFiles(
    id: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.reconciler.reconcileById(id);
    if (this.paths.shouldUseRunningContainer(app, query)) {
      return this.listRunningDownloadFiles(app);
    }

    return this.volumes.listFiles(app, query);
  }

  async uploadDownloadFile(
    id: string,
    request: MultipartUploadRequest,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.reconciler.reconcileById(id);
    return this.uploads.consumeFileUpload(request, (stream, originalName) =>
      this.storeDownloadFileStream(app, stream, originalName, query),
    );
  }

  async downloadFile(
    id: string,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.reconciler.reconcileById(id);
    const safeFileName = this.paths.sanitizeFileName(fileName);
    if (!this.paths.shouldUseRunningContainer(app, query)) {
      const content = await this.volumes.readFile(app, safeFileName, query);
      return this.downloadResult(safeFileName, content);
    }

    const content = await readRuntimeDownload(
      this.archive,
      app.containerId!,
      `${this.paths.downloadDirectory}/${safeFileName}`,
    );

    return this.downloadResult(safeFileName, content);
  }

  private async listRunningDownloadFiles(app: AndroidApplication) {
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          `dir="${this.paths.downloadDirectory}"`,
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

    return parseDownloadFiles(stdout, this.paths.downloadDirectory);
  }

  private async storeDownloadFileStream(
    app: AndroidApplication,
    stream: Readable,
    originalName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const fileName = this.paths.sanitizeFileName(originalName);
    if (!this.paths.shouldUseRunningContainer(app, query)) {
      return this.volumes.storeStream(app, stream, fileName, query);
    }

    return this.storeRunningDownloadFileStream(app, stream, fileName);
  }

  private async storeRunningDownloadFileStream(
    app: AndroidApplication,
    stream: Readable,
    fileName: string,
  ): Promise<ApplicationRuntimeFileUploadDto> {
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `mkdir -p ${this.paths.shellQuote(this.paths.downloadDirectory)}`,
    ]);

    const sizeBytes = await this.uploads.withStagedFile(
      stream,
      async (tempPath) => {
        await this.archive.copyFileToContainer(
          app.containerId!,
          tempPath,
          this.paths.downloadDirectory,
          fileName,
        );
        await this.prepareRunningDownloadFile(app, fileName);
        this.scanRunningDownloadFileInBackground(app, fileName);
      },
    );

    return this.volumes.uploadResult(fileName, sizeBytes);
  }

  private async prepareRunningDownloadFile(
    app: AndroidApplication,
    fileName: string,
  ) {
    const filePath = `${this.paths.downloadDirectory}/${fileName}`;

    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      [
        `file_path=${this.paths.shellQuote(filePath)}`,
        'chown 1023:1023 "$file_path" 2>/dev/null || true',
        'chmod 0644 "$file_path" 2>/dev/null || true',
        'sync "$file_path" 2>/dev/null || sync',
      ].join('\n'),
    ]);
  }

  private scanRunningDownloadFileInBackground(
    app: AndroidApplication,
    fileName: string,
  ) {
    void this.scanRunningDownloadFile(app, fileName).catch((error) => {
      void this.logs.append(app.id, 'Uploaded file media scan failed', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async scanRunningDownloadFile(
    app: AndroidApplication,
    fileName: string,
  ) {
    const filePath = `${this.paths.downloadDirectory}/${fileName}`;
    const publicPath = `/sdcard/Download/${fileName}`;

    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      [
        `file_path=${this.paths.shellQuote(filePath)}`,
        `public_path=${this.paths.shellQuote(publicPath)}`,
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

  private downloadResult(fileName: string, content: Buffer) {
    return {
      name: fileName,
      mimeType: 'application/octet-stream',
      dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
    };
  }
}
