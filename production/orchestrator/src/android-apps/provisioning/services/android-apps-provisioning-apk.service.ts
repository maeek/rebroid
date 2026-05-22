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

    await this.logs.appendLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
    });
    await this.state.setLifecycle(app.id, {
      status: AndroidApplicationStatus.Running,
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage,
    });

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

    await this.logs.append(app.id, 'Starting APK install command', {
      target: targetPath,
    });
    const packagesBefore = await this.listThirdPartyPackages(app.containerId);
    const installResult = await this.exec.execInContainerWithOutput(app.containerId, [
      'sh',
      '-lc',
      this.pmInstallCommand(targetPath),
    ]);
    const packageName = await this.resolveInstalledPackageName(
      app.containerId,
      packagesBefore,
      app.apkPackageName,
    );

    if (packageName) {
      app.apkPackageName = packageName;
      await this.state.save(app);
    }

    await this.logs.append(app.id, 'APK install command completed', {
      target: targetPath,
      packageName,
      stdout: installResult.stdout.trim() || null,
      stderr: installResult.stderr.trim() || null,
    });
  }

  /** Opens the installed APK launcher activity when the runtime is running. */
  async launchInstalledApk(app: AndroidApplication) {
    if (!app.containerId || !app.apkFilePath) {
      return;
    }

    const packageName =
      app.apkPackageName ??
      (await this.resolveInstalledPackageName(app.containerId, [], null));
    if (!packageName) {
      await this.logs.append(app.id, 'APK launch skipped', {
        reason: 'Could not determine installed package name.',
      });
      return;
    }

    app.apkPackageName = packageName;
    await this.state.save(app);
    await this.logs.append(app.id, 'Launching installed APK', {
      packageName,
    });
    const result = await this.exec.execInContainerWithOutput(app.containerId, [
      'sh',
      '-lc',
      this.launchPackageCommand(packageName),
    ]);
    await this.logs.append(app.id, 'Installed APK launch command completed', {
      packageName,
      stdout: result.stdout.trim() || null,
      stderr: result.stderr.trim() || null,
    });
  }

  /** Builds the shell script used for APK install. */
  private pmInstallCommand(apkPath: string) {
    return [
      `apk_path=${this.shellQuote(apkPath)}`,
      'pm install -r -t -g "$apk_path" &',
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

  /** Builds the shell script used for launching an installed package. */
  private launchPackageCommand(packageName: string) {
    return [
      `package_name=${this.shellQuote(packageName)}`,
      'monkey -p "$package_name" -c android.intent.category.LAUNCHER 1',
    ].join('\n');
  }

  /** Reads third-party package names from Android package manager. */
  private async listThirdPartyPackages(containerId: string) {
    const result = await this.exec.execInContainerWithOutput(containerId, [
      'sh',
      '-lc',
      "pm list packages -3 2>/dev/null | sed 's/^package://'",
    ]);

    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /** Determines the app package after install, preferring newly added packages. */
  private async resolveInstalledPackageName(
    containerId: string,
    packagesBefore: string[],
    existingPackageName: string | null,
  ) {
    const packagesAfter = await this.listThirdPartyPackages(containerId);

    if (existingPackageName && packagesAfter.includes(existingPackageName)) {
      return existingPackageName;
    }

    const before = new Set(packagesBefore);
    const newlyInstalled = packagesAfter.filter((packageName) => !before.has(packageName));
    if (newlyInstalled.length === 1) {
      return newlyInstalled[0];
    }

    if (newlyInstalled.length > 1) {
      return newlyInstalled.sort()[0];
    }

    return packagesAfter.length === 1 ? packagesAfter[0] : null;
  }

  /** Escapes a string for safe shell use. */
  private shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
