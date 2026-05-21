import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DockerContainerArchiveService } from '../../../docker/containers/services/docker-container-archive.service';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';

@Injectable()
export class AndroidAppsProvisioningApkService {
  constructor(
    private readonly archive: DockerContainerArchiveService,
    private readonly exec: DockerContainerExecService,
    private readonly logs: AndroidAppsLogService,
    private readonly state: AndroidAppsStateService,
  ) {}

  /** Copies the APK in and runs the install command. */
  async installApk(
    app: AndroidApplication,
    statusMessage = 'Installing APK inside Android.',
  ) {
    if (!app.containerId || !app.apkFilePath) {
      throw new InternalServerErrorException('Container and APK are required.');
    }

    const targetDir = '/data/local/tmp';
    const targetName = `${app.id}.apk`;
    const targetPath = `${targetDir}/${targetName}`;

    await this.logs.append(app.id, 'Preparing APK install', {
      source: app.apkFilePath,
      target: targetPath,
    });
    await this.exec.execInContainer(app.containerId, [
      'sh',
      '-lc',
      `mkdir -p ${targetDir}`,
    ]);

    await this.logs.append(app.id, 'Copying APK into runtime container', {
      source: app.apkFilePath,
      target: targetPath,
    });
    await this.archive.copyFileToContainer(
      app.containerId,
      app.apkFilePath,
      targetDir,
      targetName,
    );
    await this.logs.append(app.id, 'APK copied into runtime container', {
      target: targetPath,
    });

    await this.state.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
    });

    await this.logs.append(app.id, 'Starting APK install command', {
      target: targetPath,
    });
    await this.exec.execInContainer(app.containerId, [
      'sh',
      '-lc',
      this.pmInstallCommand(targetPath),
    ]);
    await this.logs.append(app.id, 'APK install command completed', {
      target: targetPath,
    });
  }

  /** Builds the shell script used for APK install. */
  private pmInstallCommand(apkPath: string) {
    return [
      `apk_path=${this.shellQuote(apkPath)}`,
      'pm install -r "$apk_path" &',
      'pid=$!',
      'elapsed=0',
      'while kill -0 "$pid" 2>/dev/null; do',
      '  if [ "$elapsed" -ge 180 ]; then',
      '    kill "$pid" 2>/dev/null || true',
      '    wait "$pid" 2>/dev/null || true',
      '    echo "pm install timed out after 180s" >&2',
      '    exit 124',
      '  fi',
      '  sleep 1',
      '  elapsed=$((elapsed + 1))',
      'done',
      'wait "$pid"',
    ].join('\n');
  }

  /** Escapes a string for safe shell use. */
  private shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
