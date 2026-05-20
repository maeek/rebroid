import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { setTimeout as delay } from 'node:timers/promises';
import { Repository } from 'typeorm';
import { getErrorMessage } from '../../common/error-message';
import { DockerRuntimeService } from '../../docker/docker-runtime.service';
import { NetworkPolicyService } from '../../network-policy/network-policy.service';
import { AndroidApplication } from '../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../android-application-status';
import { isRedroidImageName } from '../utils/redroid-runtime.utils';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';
import { AndroidAppsLogService } from './android-apps-log.service';
import { AndroidAppsStateService } from './android-apps-state.service';

@Injectable()
export class AndroidAppsProvisioningService {
  private readonly logger = new Logger(AndroidAppsProvisioningService.name);

  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly docker: DockerRuntimeService,
    private readonly logs: AndroidAppsLogService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly state: AndroidAppsStateService,
    private readonly tracker: AndroidAppsProvisioningTrackerService,
  ) {}

  /**
   * Provisions a new runtime end to end while updating lifecycle stages as it progresses.
   * Cancellation is cooperative and checked between long-running Docker steps.
   */
  async provision(applicationId: string) {
    try {
      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Provisioning,
        lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
        statusMessage:
          'Checking whether the container image is available locally.',
        provisioningStartedAt: new Date(),
        lastError: null,
      });

      const app = await this.state.getStored(applicationId);
      await this.logs.append(applicationId, 'Provisioning started', {
        image: app.containerImage,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
      });
      await this.logs.append(
        applicationId,
        'Container engine selected',
        await this.docker.engineSummary(),
      );
      this.tracker.ensureActive(applicationId);

      if (!(await this.docker.imageExists(app.containerImage))) {
        this.tracker.ensureActive(applicationId);
        await this.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
          statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
        });

        await this.docker.pullImage(app.containerImage, (message) => {
          void this.state.setLifecycle(applicationId, {
            statusMessage: message || `Pulling ${app.containerImage}.`,
          });
          void this.logs
            .append(applicationId, 'Image pull progress', {
              image: app.containerImage,
              message: message || `Pulling ${app.containerImage}.`,
            })
            .catch((error) => {
              this.logger.warn(
                `Could not write image pull log for ${applicationId}: ${getErrorMessage(error)}`,
              );
            });
        });
        this.tracker.ensureActive(applicationId);
      }

      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.VolumeCreating,
        statusMessage: `Creating persistent data volume ${app.volumeName}.`,
      });
      if (app.profileMode === 'persistent') {
        await this.docker.createVolume(app.id, app.volumeName);
      }

      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.NetworkCreating,
        statusMessage: `Creating isolated internal network ${app.networkName}.`,
      });
      await this.docker.createIsolatedNetwork(app.id, app.networkName);

      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage:
          AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting,
        statusMessage: 'Connecting orchestrator to the isolated app network.',
      });
      await this.docker.connectOrchestratorToNetwork(app.networkName);
      await this.prepareViewerNetwork(app);

      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
        statusMessage: `Creating application container ${app.containerName}.`,
      });
      const container = await this.docker.createApplicationContainer({
        applicationId: app.id,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
        image: app.containerImage,
        dataMountPath: this.config.getOrThrow<string>(
          'app.redroid.dataMountPath',
        ),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
        profileMode: app.profileMode,
        memoryLimitMb: app.memoryLimitMb,
        cpuLimitCpus: app.cpuLimitCpus,
        containerArgs: app.containerArgs,
        securityOptions: this.config.getOrThrow<string[]>(
          'app.redroid.securityOptions',
        ),
      });

      this.tracker.ensureActive(applicationId);
      await this.applications.update(app.id, {
        containerId: container.id,
      });
      app.containerId = container.id;
      await this.logs.append(applicationId, 'Container created', {
        containerId: container.id,
        containerName: app.containerName,
        image: app.containerImage,
      });

      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Starting application container.',
      });
      await this.docker.startContainer(container.id);
      await this.logs.append(applicationId, 'Container start requested', {
        containerId: container.id,
      });

      const networkPolicyResult = await this.networkPolicy.apply({
        ...app,
        containerId: container.id,
      });
      await this.applications.update(app.id, {
        networkPolicyStatus: networkPolicyResult.status,
        networkPolicyMessage: networkPolicyResult.message,
        networkPolicyAppliedAt: new Date(),
        lastStartedAt: new Date(),
      });
      await this.logs.append(applicationId, 'Network policy reconciled', {
        status: networkPolicyResult.status,
        message: networkPolicyResult.message,
      });
      this.tracker.ensureActive(applicationId);

      await this.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
        statusMessage: 'Waiting for Android to finish booting.',
      });
      await this.waitForAndroidBoot(app);

      if (this.shouldConfigureRedroidAdbPort(app)) {
        this.tracker.ensureActive(applicationId);
        await this.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
          statusMessage: `Configuring Android ADB listener on port ${app.adbPort}.`,
        });
        await this.configureRedroidAdbPort(app);
      }

      if (app.apkFilePath) {
        this.tracker.ensureActive(applicationId);
        await this.installApk(app);
      }

      this.tracker.ensureActive(applicationId);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Running,
        lifecycleStage: AndroidApplicationLifecycleStage.Ready,
        statusMessage: 'Application is running.',
        provisioningCompletedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      if (this.tracker.isCancellationError(error)) {
        this.logger.log(`Provisioning cancelled for ${applicationId}.`);
        return;
      }

      if (!(error instanceof Error)) {
        this.logger.error(error);
      }
      const message = getErrorMessage(error);
      this.logger.error(`Provisioning failed for ${applicationId}: ${message}`);
      await this.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Error,
        lifecycleStage: AndroidApplicationLifecycleStage.Error,
        statusMessage: message,
        lastError: message,
      });
    }
  }

  /**
   * Copies the APK into the container and installs it after Android finishes booting.
   * Both the container id and staged APK path must already be present.
   */
  async installApk(app: AndroidApplication) {
    if (!app.containerId || !app.apkFilePath) {
      throw new InternalServerErrorException('Container and APK are required.');
    }

    const targetDir = '/data/local/tmp';
    const targetName = `${app.id}.apk`;

    await this.docker.copyFileToContainer(
      app.containerId,
      app.apkFilePath,
      targetDir,
      targetName,
    );
    await this.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage: 'Installing APK inside Android.',
    });
    await this.docker.execInContainer(app.containerId, [
      'sh',
      '-lc',
      `pm install -r ${targetDir}/${targetName}`,
    ]);
    await this.logs.append(app.id, 'APK install command completed', {
      target: `${targetDir}/${targetName}`,
    });
  }

  /**
   * Polls sys.boot_completed with a fixed timeout before APK installation.
   */
  private async waitForAndroidBoot(app: AndroidApplication) {
    if (!app.containerId) {
      throw new InternalServerErrorException('Container is required.');
    }

    const timeoutMs = 120_000;
    const intervalMs = 2_000;
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'sys.boot_completed was not reported.';

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);
      const runtimeState = await this.docker.getContainerRuntimeState(
        app.containerId,
      );

      if (!runtimeState.exists || !runtimeState.running) {
        throw new Error(this.androidBootExitedMessage(runtimeState));
      }

      try {
        const { stdout, stderr } = await this.docker.execInContainerWithOutput(
          app.containerId,
          ['sh', '-lc', 'getprop sys.boot_completed 2>/dev/null || true'],
        );
        const bootCompleted = stdout.trim();
        lastProbe =
          stderr.trim() ||
          (bootCompleted
            ? `sys.boot_completed=${bootCompleted}`
            : 'sys.boot_completed was empty.');

        if (bootCompleted === '1') {
          await this.logs.append(app.id, 'Android boot completed', {
            probe: lastProbe,
          });
          return;
        }
      } catch (error) {
        const runtimeStateAfterExec =
          await this.docker.getContainerRuntimeState(app.containerId);

        if (!runtimeStateAfterExec.exists || !runtimeStateAfterExec.running) {
          throw new Error(this.androidBootExitedMessage(runtimeStateAfterExec));
        }

        lastProbe = getErrorMessage(error);
      }

      await delay(intervalMs);
    }

    throw new Error(
      `Timed out waiting for Android to finish booting after ${timeoutMs / 1000}s. Last probe: ${lastProbe}`,
    );
  }

  private shouldConfigureRedroidAdbPort(app: AndroidApplication) {
    return isRedroidImageName(app.containerImage);
  }

  private async configureRedroidAdbPort(app: AndroidApplication) {
    if (!app.containerId) {
      throw new InternalServerErrorException('Container is required.');
    }

    await this.docker.execInContainer(app.containerId, [
      'sh',
      '-lc',
      [
        `setprop persist.adb.tcp.port ${app.adbPort}`,
        'stop adbd',
        'start adbd',
      ].join(' && '),
    ]);
    await this.waitForRedroidAdb(app);
    await this.logs.append(app.id, 'Configured redroid ADB listener', {
      adbPort: app.adbPort,
    });
  }

  private async waitForRedroidAdb(app: AndroidApplication) {
    if (!app.containerId) {
      throw new InternalServerErrorException('Container is required.');
    }

    const timeoutMs = 20_000;
    const intervalMs = 1_000;
    const deadline = Date.now() + timeoutMs;
    let lastProbe = 'ADB service state was not reported.';

    while (Date.now() < deadline) {
      this.tracker.ensureActive(app.id);

      const { stdout, stderr } = await this.docker.execInContainerWithOutput(
        app.containerId,
        [
          'sh',
          '-lc',
          [
            'adb_port=$(getprop persist.adb.tcp.port 2>/dev/null || true)',
            'adbd_state=$(getprop init.svc.adbd 2>/dev/null || true)',
            'printf "%s\t%s" "$adb_port" "$adbd_state"',
          ].join(' && '),
        ],
      );

      const [adbPort, adbdState] = stdout.trim().split('\t');
      lastProbe =
        stderr.trim() ||
        `persist.adb.tcp.port=${adbPort || '<empty>'}, init.svc.adbd=${adbdState || '<empty>'}`;

      if (adbPort === String(app.adbPort) && adbdState === 'running') {
        return;
      }

      await delay(intervalMs);
    }

    throw new Error(
      `Timed out waiting for redroid ADB after ${timeoutMs / 1000}s. Last probe: ${lastProbe}`,
    );
  }

  private async prepareViewerNetwork(app: AndroidApplication) {
    try {
      const sidecarTarget = await this.docker.ensureWsScrcpySidecarOnNetwork(
        app.networkName,
      );
      await this.logs.append(app.id, 'ws-scrcpy network prepared', {
        networkName: app.networkName,
        configured: sidecarTarget.configured,
        connected: sidecarTarget.connected,
        message: sidecarTarget.message,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      this.logger.warn(
        `Could not prepare ws-scrcpy network for ${app.id}: ${message}`,
      );
      await this.logs.append(app.id, 'ws-scrcpy network preparation failed', {
        networkName: app.networkName,
        message,
      });
    }
  }

  private androidBootExitedMessage(
    runtimeState: Awaited<
      ReturnType<DockerRuntimeService['getContainerRuntimeState']>
    >,
  ) {
    if (!runtimeState.exists) {
      return 'Managed container no longer exists before Android finished booting.';
    }

    const exitCode =
      runtimeState.exitCode === null || runtimeState.exitCode === undefined
        ? ''
        : ` with exit code ${runtimeState.exitCode}`;
    const dockerError = runtimeState.error
      ? ` Docker reported: ${runtimeState.error}`
      : '';

    return `Managed container ${runtimeState.status ?? 'exited'}${exitCode} before Android finished booting.${dockerError}`;
  }

  private async setLifecycle(
    applicationId: string,
    patch: Parameters<AndroidAppsStateService['setLifecycle']>[1],
  ) {
    await this.logs.appendLifecycle(applicationId, patch);
    await this.state.setLifecycle(applicationId, patch);
  }
}
