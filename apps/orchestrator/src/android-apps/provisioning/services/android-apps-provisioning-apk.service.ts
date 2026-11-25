import { shellQuote } from '../../../common/shell-quote';
import {
  Inject,
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  APK_PACKAGE_INSPECTION,
  type ApkPackageInspectionPort,
} from '../../../apk/contracts/apk-package-inspection.port';
import {
  APK_CATALOG,
  type ApkCatalogPort,
} from '../../../apk/contracts/apk-catalog.port';
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
import { AndroidAppsLogService } from '../../common/services/android-apps-log.service';
import { AndroidAppsStateWriter } from '../../common/services/android-apps-state-writer.service';
import {
  buildLaunchPackageCommand,
  buildPmInstallCommand,
  resolveInstalledPackageName,
} from '../utils/android-apps-apk-provisioning.utils';

@Injectable()
export class AndroidAppsProvisioningApkService {
  constructor(
    @Inject(DOCKER_CONTAINER_ARCHIVE)
    private readonly archive: DockerContainerArchivePort,
    @Inject(DOCKER_CONTAINER_EXEC)
    private readonly exec: DockerContainerExecPort,
    private readonly logs: AndroidAppsLogService,
    private readonly writer: AndroidAppsStateWriter,
    @Inject(APK_PACKAGE_INSPECTION)
    private readonly apkMetadata: ApkPackageInspectionPort,
    @Inject(APK_CATALOG) private readonly apks: ApkCatalogPort,
  ) {}

  async installApk(app: AndroidApplication) {
    if (!app.uploadedApkId)
      throw new ConflictException('Choose an available APK before installing.');
    return this.apks.withReference(app.uploadedApkId, (apk) => {
      if (
        apk.ownerUserId !== app.ownerUserId ||
        apk.filePath !== app.apkFilePath
      ) {
        throw new ConflictException(
          'Choose an available APK before installing.',
        );
      }
      return this.installAttachedApk(app);
    });
  }

  private async installAttachedApk(app: AndroidApplication) {
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
    const installResult = await this.runApkCommand(
      app.id,
      app.containerId,
      buildPmInstallCommand(targetPath),
      'APK install command failed',
      { target: targetPath },
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
    await this.writer.setApkPackageName(app.id, packageName);

    await this.logs.append(app.id, 'APK install command completed', {
      target: targetPath,
      declaredPackageName,
      packageName,
      stdout: installResult.stdout.trim() || null,
      stderr: installResult.stderr.trim() || null,
    });
  }

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
    await this.writer.setApkPackageName(app.id, packageName);
    await this.logs.append(app.id, 'Launching installed APK', {
      packageName,
    });
    const result = await this.runApkCommand(
      app.id,
      app.containerId,
      buildLaunchPackageCommand(packageName),
      'Installed APK launch command failed',
      { packageName },
    );
    await this.logs.append(app.id, 'Installed APK launch command completed', {
      packageName,
      stdout: result.stdout.trim() || null,
      stderr: result.stderr.trim() || null,
    });
  }

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

  private async runApkCommand(
    applicationId: string,
    containerId: string,
    command: string,
    failureMessage: string,
    context: { target: string } | { packageName: string },
  ) {
    try {
      return await this.exec.execInContainerWithOutput(containerId, [
        'sh',
        '-lc',
        command,
      ]);
    } catch (error) {
      const details =
        error instanceof ContainerCommandFailedException ? error.details : null;
      await this.logs.append(applicationId, failureMessage, {
        ...context,
        error: getErrorMessage(error),
        stdout: details?.stdout?.trim() || null,
        stderr: details?.stderr?.trim() || null,
        exitCode: details?.exitCode ?? null,
      });
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
