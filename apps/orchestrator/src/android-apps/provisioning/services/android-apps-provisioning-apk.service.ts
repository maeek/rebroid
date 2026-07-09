import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApkIconExtractorService } from '../../../apk/services/apk-icon-extractor.service';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_CONTAINER_ARCHIVE,
  type DockerContainerArchivePort,
} from '../../../docker/contracts/docker-container-archive.port';
import {
  DOCKER_CONTAINER_EXEC,
  type DockerContainerExecPort,
} from '../../../docker/contracts/docker-container-exec.port';
import { ContainerCommandFailedException } from '../../../docker/docker.types';
import { AndroidApplication } from '../../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../../contracts/android-application-status';
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateService } from '../../common/services/android-apps-state.service';
import {
  buildLaunchPackageCommand,
  buildPmInstallCommand,
  resolveInstalledPackageName,
  shellQuote,
} from '../utils/android-apps-apk-provisioning.utils';

@Injectable()
export class AndroidAppsProvisioningApkService {
  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
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
      `chmod 0644 ${shellQuote(targetPath)} && sync`,
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
    const packagesAfter = await this.listThirdPartyPackages(app.containerId);
    const packageName = resolveInstalledPackageName({
      packagesBefore,
      packagesAfter,
      existingPackageName: app.apkPackageName ?? declaredPackageName,
    });

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
      resolveInstalledPackageName({
        packagesBefore: [],
        packagesAfter: await this.listThirdPartyPackages(app.containerId),
        existingPackageName: await this.extractPackageNameFromApk(app),
      });
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
        buildPmInstallCommand(targetPath),
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
        buildLaunchPackageCommand(packageName),
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
        `apk_path=${shellQuote(apkPath)}`,
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

  /** Reads the declared package name from the APK file when available. */
  private async extractPackageNameFromApk(app: AndroidApplication) {
    if (!app.apkFilePath) {
      return null;
    }

    try {
      return this.apkMetadata.extractPackageNameFromFile(app.apkFilePath);
    } catch {
      return null;
    }
  }
}
