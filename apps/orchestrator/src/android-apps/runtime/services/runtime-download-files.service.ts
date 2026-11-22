import { shellQuote } from '../../../common/shell-quote';
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
import { assertMutableApplication } from '../../common/utils/mutable-application';
import { AndroidApplication } from '../../android-application.entity';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsRuntimeStateReconciler } from '../../common/services/android-apps-runtime-state-reconciler.service';
import { ApplicationRuntimeFileUploadDto } from '../dto/application-runtime-file.dto';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import {
  parseDownloadFiles,
  sanitizeRuntimeFileName,
} from '../utils/android-apps-runtime-file.utils';
import { runtimeDownloadTarget } from '../utils/runtime-download-target';
import { readRuntimeDownload } from '../utils/runtime-download-limit';
import { RuntimeDownloadVolumeService } from './runtime-download-volume.service';
import { downloadDirectory } from '../utils/runtime-file-path';
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
    private readonly volumes: RuntimeDownloadVolumeService,
    private readonly uploads: RuntimeUploadStreamService,
  ) {}

  async listDownloadFiles(
    id: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.reconciler.reconcileById(id);
    const target = runtimeDownloadTarget(app, query);
    if (target.kind === 'container') {
      return this.listRunningDownloadFiles(target.containerId);
    }

    return this.volumes.listFiles(app, target.profileName);
  }

  async uploadDownloadFile(
    id: string,
    request: MultipartUploadRequest,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    return this.uploads.consumeFileUpload(id, request, async () => {
      const app = await this.reconciler.reconcileById(id);
      assertMutableApplication(app);
      return (stream, name) =>
        this.storeDownloadFileStream(app, stream, name, query);
    });
  }

  async downloadFile(
    id: string,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    const app = await this.reconciler.reconcileById(id);
    const safeFileName = sanitizeRuntimeFileName(fileName);
    const target = runtimeDownloadTarget(app, query);
    const content =
      target.kind === 'volume'
        ? await this.volumes.readFile(app, safeFileName, target.profileName)
        : await readRuntimeDownload(
            this.archive,
            target.containerId,
            `${downloadDirectory}/${safeFileName}`,
          );
    return {
      name: safeFileName,
      mimeType: 'application/octet-stream',
      dataUrl: `data:application/octet-stream;base64,${content.toString('base64')}`,
    };
  }

  private async listRunningDownloadFiles(containerId: string) {
    const { stdout } = await this.exec.execInContainerWithOutput(containerId, [
      'sh',
      '-lc',
      [
        `dir="${downloadDirectory}"`,
        'mkdir -p "$dir"',
        'find "$dir" -maxdepth 1 -type f -print 2>/dev/null | while IFS= read -r file; do',
        'name=${file##*/}',
        'size=$(stat -c %s "$file" 2>/dev/null || wc -c < "$file" 2>/dev/null || echo 0)',
        'modified=$(stat -c %Y "$file" 2>/dev/null || echo 0)',
        'printf "%s\\t%s\\t%s\\n" "$name" "$size" "$modified"',
        'done',
      ].join('\n'),
    ]);

    return parseDownloadFiles(stdout, downloadDirectory);
  }

  private async storeDownloadFileStream(
    app: AndroidApplication,
    stream: Readable,
    originalName: string,
    query: ApplicationRuntimeFilesQueryDto,
  ) {
    const fileName = sanitizeRuntimeFileName(originalName);
    const target = runtimeDownloadTarget(app, query);
    if (target.kind === 'volume') {
      return this.volumes.storeStream(
        app,
        stream,
        fileName,
        target.profileName,
      );
    }

    return this.storeRunningDownloadFileStream(
      app.id,
      target.containerId,
      stream,
      fileName,
    );
  }

  private async storeRunningDownloadFileStream(
    appId: string,
    containerId: string,
    stream: Readable,
    fileName: string,
  ): Promise<ApplicationRuntimeFileUploadDto> {
    await this.exec.execInContainer(containerId, [
      'sh',
      '-lc',
      `mkdir -p ${shellQuote(downloadDirectory)}`,
    ]);

    const sizeBytes = await this.uploads.withStagedFile(
      stream,
      async (tempPath) => {
        await this.archive.copyFileToContainer(
          containerId,
          tempPath,
          downloadDirectory,
          fileName,
        );
        await this.prepareRunningDownloadFile(containerId, fileName);
        this.scanRunningDownloadFileInBackground(appId, containerId, fileName);
      },
    );

    return this.volumes.uploadResult(fileName, sizeBytes);
  }

  private async prepareRunningDownloadFile(
    containerId: string,
    fileName: string,
  ) {
    const filePath = `${downloadDirectory}/${fileName}`;

    await this.exec.execInContainer(containerId, [
      'sh',
      '-lc',
      [
        `file_path=${shellQuote(filePath)}`,
        'chown 1023:1023 "$file_path" 2>/dev/null || true',
        'chmod 0644 "$file_path" 2>/dev/null || true',
        'sync "$file_path" 2>/dev/null || sync',
      ].join('\n'),
    ]);
  }

  private scanRunningDownloadFileInBackground(
    appId: string,
    containerId: string,
    fileName: string,
  ) {
    void this.scanRunningDownloadFile(containerId, fileName).catch((error) => {
      void this.logs.append(appId, 'Uploaded file media scan failed', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async scanRunningDownloadFile(containerId: string, fileName: string) {
    const filePath = `${downloadDirectory}/${fileName}`;
    const publicPath = `/sdcard/Download/${fileName}`;

    await this.exec.execInContainer(containerId, [
      'sh',
      '-lc',
      [
        `file_path=${shellQuote(filePath)}`,
        `public_path=${shellQuote(publicPath)}`,
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
}
