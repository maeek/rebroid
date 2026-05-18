import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getErrorMessage } from '../../common/error-message';
import { DockerRuntimeService } from '../../docker/docker-runtime.service';
import { NetworkPolicyService } from '../../network-policy/network-policy.service';
import { AndroidApplication } from '../android-application.entity';
import {
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
} from '../android-application-status';
import { AndroidAppsProvisioningTrackerService } from './android-apps-provisioning-tracker.service';
import { AndroidAppsStateService } from './android-apps-state.service';

@Injectable()
export class AndroidAppsProvisioningService {
  private readonly logger = new Logger(AndroidAppsProvisioningService.name);

  constructor(
    @InjectRepository(AndroidApplication)
    private readonly applications: Repository<AndroidApplication>,
    private readonly config: ConfigService,
    private readonly docker: DockerRuntimeService,
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
      await this.state.setLifecycle(applicationId, {
        status: AndroidApplicationStatus.Provisioning,
        lifecycleStage: AndroidApplicationLifecycleStage.ImageChecking,
        statusMessage:
          'Checking whether the container image is available locally.',
        provisioningStartedAt: new Date(),
        lastError: null,
      });

      const app = await this.state.getStored(applicationId);
      this.tracker.ensureActive(applicationId);

      if (!(await this.docker.imageExists(app.containerImage))) {
        this.tracker.ensureActive(applicationId);
        await this.state.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.ImagePulling,
          statusMessage: `Docker image "${app.containerImage}" is not available locally. Pulling it now.`,
        });

        await this.docker.pullImage(app.containerImage, (message) => {
          void this.state.setLifecycle(applicationId, {
            statusMessage: message || `Pulling ${app.containerImage}.`,
          });
        });
        this.tracker.ensureActive(applicationId);
      }

      this.tracker.ensureActive(applicationId);
      await this.state.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.VolumeCreating,
        statusMessage: `Creating persistent data volume ${app.volumeName}.`,
      });
      if (app.profileMode === 'persistent') {
        await this.docker.createVolume(app.id, app.volumeName);
      }

      this.tracker.ensureActive(applicationId);
      await this.state.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.NetworkCreating,
        statusMessage: `Creating isolated internal network ${app.networkName}.`,
      });
      await this.docker.createIsolatedNetwork(app.id, app.networkName);

      this.tracker.ensureActive(applicationId);
      await this.state.setLifecycle(applicationId, {
        lifecycleStage:
          AndroidApplicationLifecycleStage.OrchestratorNetworkConnecting,
        statusMessage: 'Connecting orchestrator to the isolated app network.',
      });
      await this.docker.connectOrchestratorToNetwork(app.networkName);

      this.tracker.ensureActive(applicationId);
      await this.state.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerCreating,
        statusMessage: `Creating application container ${app.containerName}.`,
      });
      const container = await this.docker.createApplicationContainer({
        applicationId: app.id,
        containerName: app.containerName,
        networkName: app.networkName,
        volumeName: app.volumeName,
        image: app.containerImage,
        dataMountPath: this.config.getOrThrow<string>('app.redroid.dataMountPath'),
        adbPort: app.adbPort,
        privileged: this.config.getOrThrow<boolean>('app.redroid.privileged'),
        profileMode: app.profileMode,
        memoryLimitMb: app.memoryLimitMb,
        cpuLimitCpus: app.cpuLimitCpus,
        containerArgs: app.containerArgs,
      });

      this.tracker.ensureActive(applicationId);
      await this.applications.update(app.id, {
        containerId: container.id,
      });

      this.tracker.ensureActive(applicationId);
      await this.state.setLifecycle(applicationId, {
        lifecycleStage: AndroidApplicationLifecycleStage.ContainerStarting,
        statusMessage: 'Starting application container.',
      });
      await this.docker.startContainer(container.id);

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
      this.tracker.ensureActive(applicationId);

      if (app.apkFilePath) {
        this.tracker.ensureActive(applicationId);
        await this.state.setLifecycle(applicationId, {
          lifecycleStage: AndroidApplicationLifecycleStage.AndroidBooting,
          statusMessage:
            'Waiting for Android to finish booting before APK install.',
        });
        await this.installApk({ ...app, containerId: container.id });
      }

      this.tracker.ensureActive(applicationId);
      await this.state.setLifecycle(applicationId, {
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
      await this.state.setLifecycle(applicationId, {
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
    await this.waitForAndroidBoot(app.containerId);
    await this.state.setLifecycle(app.id, {
      lifecycleStage: AndroidApplicationLifecycleStage.ApkInstalling,
      statusMessage: 'Installing APK inside Android.',
    });
    await this.docker.execInContainer(app.containerId, [
      'sh',
      '-lc',
      `pm install -r ${targetDir}/${targetName}`,
    ]);
  }

  /**
   * Polls sys.boot_completed with a fixed timeout before APK installation.
   */
  private async waitForAndroidBoot(containerId: string) {
    await this.docker.execInContainer(containerId, [
      'sh',
      '-lc',
      'i=0; while [ "$i" -lt 60 ]; do [ "$(getprop sys.boot_completed 2>/dev/null)" = "1" ] && exit 0; i=$((i+1)); sleep 2; done; exit 1',
    ]);
  }
}