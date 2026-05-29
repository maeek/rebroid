import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { ApkIconExtractorService } from '../../../apk/services/apk-icon-extractor.service';
import { getErrorMessage } from '../../../common/error-message';
import { DockerContainerArchiveService } from '../../../docker/containers/services/docker-container-archive.service';
import { DockerContainerExecService } from '../../../docker/containers/services/docker-container-exec.service';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
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
    private readonly apkMetadata: ApkIconExtractorService,
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
    await this.exec.execInContainer(app.containerId, [
      'sh',
      '-lc',
      `chmod 0644 ${this.shellQuote(targetPath)} && sync`,
    ]);
    const stagedApk = await this.inspectStagedApk(app.containerId, targetPath);
    await this.logs.append(app.id, 'APK copied into runtime container', {
      target: targetPath,
      stagedApk,
    });

    await this.logs.append(app.id, 'Starting APK install command', {
      target: targetPath,
    });
    const packagesBefore = await this.listThirdPartyPackages(app.containerId);
    const declaredPackageName = await this.extractPackageNameFromApk(app);
    const installResult = await this.runApkInstallCommand(
      app.id,
      app.containerId,
      targetPath,
    );
    const packageName = await this.resolveInstalledPackageName(
      app.containerId,
      packagesBefore,
      app.apkPackageName ?? declaredPackageName,
    );

    if (!packageName) {
      throw new InternalServerErrorException(
        'APK install completed, but Android did not report the installed package.',
      );
    }

    app.apkPackageName = packageName;
    await this.state.save(app);

    await this.logs.append(app.id, 'APK install command completed', {
      target: targetPath,
      declaredPackageName,
      packageName,
      stdout: installResult.stdout.trim() || null,
      stderr: installResult.stderr.trim() || null,
    });
  }

  /** Opens the installed APK launcher activity when the runtime is running. */
  async launchInstalledApk(app: AndroidApplication) {
    if (!app.containerId || !app.apkFilePath) {
      await this.logs.append(app.id, 'APK launch skipped', {
        hasContainer: Boolean(app.containerId),
        hasApk: Boolean(app.apkFilePath),
      });
      return;
    }

    const packageName =
      app.apkPackageName ??
      (await this.resolveInstalledPackageName(
        app.containerId,
        [],
        await this.extractPackageNameFromApk(app),
      ));
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
    const result = await this.runLaunchPackageCommand(
      app.id,
      app.containerId,
      packageName,
    );
    await this.logs.append(app.id, 'Installed APK launch command completed', {
      packageName,
      stdout: result.stdout.trim() || null,
      stderr: result.stderr.trim() || null,
    });
  }

  /** Checks whether the recorded APK package is installed in Android now. */
  async isInstalled(app: AndroidApplication) {
    if (!app.containerId || !app.apkFilePath) {
      await this.logs.append(app.id, 'APK installed state skipped', {
        hasContainer: Boolean(app.containerId),
        hasApk: Boolean(app.apkFilePath),
      });
      return false;
    }

    const packageName =
      app.apkPackageName ?? (await this.extractPackageNameFromApk(app));
    if (!packageName) {
      await this.logs.append(app.id, 'APK installed state unknown', {
        reason: 'Could not determine APK package name.',
        apkOriginalName: app.apkOriginalName,
      });
      return false;
    }

    const packages = await this.listThirdPartyPackages(app.containerId);
    const installed = packages.includes(packageName);
    await this.logs.append(app.id, 'APK installed state checked', {
      packageName,
      installed,
      thirdPartyPackageCount: packages.length,
    });
    return installed;
  }

  /** Runs the APK install command and logs captured output on failure. */
  private async runApkInstallCommand(
    applicationId: string,
    containerId: string,
    targetPath: string,
  ) {
    try {
      return await this.exec.execInContainerWithOutput(containerId, [
        'sh',
        '-lc',
        this.pmInstallCommand(targetPath),
      ]);
    } catch (error) {
      await this.logs.append(applicationId, 'APK install command failed', {
        target: targetPath,
        error: getErrorMessage(error),
        stdout:
          error instanceof ContainerCommandFailedException
            ? error.details.stdout?.trim() || null
            : null,
        stderr:
          error instanceof ContainerCommandFailedException
            ? error.details.stderr?.trim() || null
            : null,
        exitCode:
          error instanceof ContainerCommandFailedException
            ? error.details.exitCode
            : null,
      });
      throw error;
    }
  }

  /** Runs the launch command and logs captured output on failure. */
  private async runLaunchPackageCommand(
    applicationId: string,
    containerId: string,
    packageName: string,
  ) {
    try {
      return await this.exec.execInContainerWithOutput(containerId, [
        'sh',
        '-lc',
        this.launchPackageCommand(packageName),
      ]);
    } catch (error) {
      await this.logs.append(
        applicationId,
        'Installed APK launch command failed',
        {
          packageName,
          error: getErrorMessage(error),
          stdout:
            error instanceof ContainerCommandFailedException
              ? error.details.stdout?.trim() || null
              : null,
          stderr:
            error instanceof ContainerCommandFailedException
              ? error.details.stderr?.trim() || null
              : null,
          exitCode:
            error instanceof ContainerCommandFailedException
              ? error.details.exitCode
              : null,
        },
      );
      throw error;
    }
  }

  /** Builds the shell script used for APK install. */
  private pmInstallCommand(apkPath: string) {
    return [
      `apk_path=${this.shellQuote(apkPath)}`,
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
      '      echo "pm install timed out after ${timeout_seconds}s" >&2',
      '      return 124',
      '    fi',
      '    sleep 1',
      '    elapsed=$((elapsed + 1))',
      '  done',
      '  wait "$pid"',
      '}',
      'run_streamed_install() {',
      '  pm install -r -t -g -S "$apk_size" - < "$apk_path"',
      '}',
      'echo "Installing APK from staged file: $apk_path"',
      'if run_with_timeout 180 pm install -r -t -g "$apk_path"; then',
      '  exit 0',
      'fi',
      'path_status=$?',
      'echo "pm install from staged file failed with exit code ${path_status}; retrying streamed install" >&2',
      'apk_size=$(wc -c < "$apk_path" | tr -d " ")',
      'if [ -z "$apk_size" ] || [ "$apk_size" -le 0 ]; then',
      '  echo "staged APK is empty or unreadable: $apk_path" >&2',
      '  exit 1',
      'fi',
      'run_with_timeout 180 run_streamed_install',
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

  /** Captures the staged file metadata from inside the runtime container. */
  private async inspectStagedApk(containerId: string, apkPath: string) {
    const result = await this.exec.execInContainerWithOutput(containerId, [
      'sh',
      '-lc',
      [
        `apk_path=${this.shellQuote(apkPath)}`,
        'ls -l "$apk_path"',
        'printf "bytes="',
        'wc -c < "$apk_path" | tr -d " "',
      ].join('\n'),
    ]);

    return {
      stdout: result.stdout.trim() || null,
      stderr: result.stderr.trim() || null,
    };
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
    const newlyInstalled = packagesAfter.filter(
      (packageName) => !before.has(packageName),
    );
    if (newlyInstalled.length === 1) {
      return newlyInstalled[0];
    }

    if (newlyInstalled.length > 1) {
      return newlyInstalled.sort()[0];
    }

    return packagesAfter.length === 1 ? packagesAfter[0] : null;
  }

  /** Reads the declared package name from the APK file when available. */
  private async extractPackageNameFromApk(app: AndroidApplication) {
    if (!app.apkFilePath) {
      return null;
    }

    try {
      return this.apkMetadata.extractPackageName(
        await readFile(app.apkFilePath),
      );
    } catch {
      return null;
    }
  }

  /** Escapes a string for safe shell use. */
  private shellQuote(value: string) {
    return `'${value.replaceAll("'", "'\\''")}'`;
  }
}
