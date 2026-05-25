import { ConflictException, Injectable } from '@nestjs/common';
import { DockerContainerArchiveService } from '../../../docker/containers/services/docker-container-archive.service';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';
import { AndroidAppsSidecarAdbService } from '../../viewer/services/android-apps-sidecar-adb.service';
import {
  parseDownloadFiles,
  sanitizeRuntimeFileName,
} from '../utils/android-apps-runtime-file.utils';

@Injectable()
export class AndroidAppsRuntimeAccessService {
  private readonly downloadDirectory = '/sdcard/Download';

  constructor(
    private readonly archive: DockerContainerArchiveService,
    private readonly exec: DockerContainerExecService,
    private readonly lifecycle: DockerContainerLifecycleService,
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

  /** Lists files in the Android Download folder. */
  async listDownloadFiles(id: string) {
    const app = await this.getRunningRuntimeApp(id);
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
  async uploadDownloadFile(id: string, file?: Express.Multer.File) {
    if (!file) {
      throw new ConflictException('A file upload is required.');
    }

    const app = await this.getRunningRuntimeApp(id);
    const fileName = sanitizeRuntimeFileName(file.originalname);
    await this.exec.execInContainer(app.containerId!, [
      'sh',
      '-lc',
      `mkdir -p "${this.downloadDirectory}"`,
    ]);
    await this.archive.copyBufferToContainer(
      app.containerId!,
      file.buffer,
      this.downloadDirectory,
      fileName,
    );

    return {
      uploaded: true,
      name: fileName,
      path: `${this.downloadDirectory}/${fileName}`,
      sizeBytes: file.size,
      modifiedAt: new Date().toISOString(),
    };
  }

  /** Downloads one file from the Download folder. */
  async downloadFile(id: string, fileName: string) {
    const app = await this.getRunningRuntimeApp(id);
    const safeFileName = sanitizeRuntimeFileName(fileName);
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
}
