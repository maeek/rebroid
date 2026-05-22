import { ConflictException, Injectable } from '@nestjs/common';
import { DockerContainerArchiveService } from '../../../docker/containers/services/docker-container-archive.service';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { AndroidApplicationStatus } from '../../android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import { parseAndroidNotifications } from '../utils/android-apps-notification.utils';
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
    private readonly state: AndroidAppsStateService,
  ) {}

  /** Reads recent Android notifications. */
  async notifications(id: string) {
    const app = await this.state.get(id);
    if (!app.containerId || app.status !== AndroidApplicationStatus.Running) {
      return [];
    }

    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId,
      [
        'sh',
        '-lc',
        [
          'output="$(cmd notification list --noredact 2>/dev/null || true)"',
          'if [ -z "$output" ]; then output="$(cmd notification list 2>/dev/null || true)"; fi',
          'if [ -z "$output" ]; then output="$(dumpsys notification --noredact 2>/dev/null || true)"; fi',
          'if [ -z "$output" ]; then output="$(dumpsys notification 2>/dev/null || true)"; fi',
          'printf "%s\\n" "$output" | sed -n "1,240p"',
        ].join('; '),
      ],
    );

    return parseAndroidNotifications(stdout);
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

  /** Reads recent ADB and ws-scrcpy logs. */
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

    const { stdout, stderr } = await this.exec.execInContainerWithOutput(
      app.containerId,
      [
        'sh',
        '-lc',
        [
          'if [ -f /data/local/tmp/ws_scrcpy.log ]; then',
          '  echo "== ws-scrcpy server ==";',
          '  tail -n 200 /data/local/tmp/ws_scrcpy.log 2>&1;',
          '  echo;',
          'fi;',
          'echo "== logcat ==";',
          `logcat -d -t ${Math.max(1, Math.min(tail, 2000))} 2>&1 || true`,
        ].join(' '),
      ],
    );

    return {
      source: 'adb' as const,
      collectedAt: new Date().toISOString(),
      output: stdout || stderr,
    };
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
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        'if command -v cmd >/dev/null 2>&1; then cmd clipboard get 2>/dev/null || true; else echo __REBROID_UNSUPPORTED__; fi',
      ],
    );
    const text = stdout.replace(/\r?\n$/, '');
    const supported = text !== '__REBROID_UNSUPPORTED__';

    return {
      text: supported ? text : '',
      supported,
      message: supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  /** Writes text to the Android clipboard. */
  async setClipboard(id: string, text: string) {
    const app = await this.getRunningRuntimeApp(id);
    const encoded = Buffer.from(text, 'utf-8').toString('base64');
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      [
        'sh',
        '-lc',
        [
          'if command -v cmd >/dev/null 2>&1; then',
          `text=$(printf '%s' '${encoded}' | base64 -d 2>/dev/null)`,
          'cmd clipboard set "$text" >/dev/null 2>&1 && echo __SMA_OK__ || echo __REBROID_UNSUPPORTED__',
          'else echo __REBROID_UNSUPPORTED__',
          'fi',
        ].join(' '),
      ],
    );
    const supported = stdout.trim() !== '__REBROID_UNSUPPORTED__';

    return {
      text: supported ? text : '',
      supported,
      message: supported
        ? null
        : 'Clipboard commands are not available in this container image.',
    };
  }

  /** Captures a screenshot from the running app. */
  async screenshot(id: string) {
    const app = await this.getRunningRuntimeApp(id);
    const { stdout } = await this.exec.execInContainerWithOutput(
      app.containerId!,
      ['sh', '-lc', 'screencap -p 2>/dev/null | base64 | tr -d "\\n" || true'],
    );
    const base64 = stdout.trim();
    if (!base64) {
      throw new ConflictException(
        'Screenshot capture is not available in this container image.',
      );
    }

    return {
      mimeType: 'image/png',
      dataUrl: `data:image/png;base64,${base64}`,
      capturedAt: new Date().toISOString(),
    };
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
