import { Inject, Injectable, Logger } from '@nestjs/common';
import { getErrorMessage } from '../../../common/error-message';
import {
  DOCKER_CONTAINER_LIFECYCLE,
  type DockerContainerLifecyclePort,
} from '../../../docker/contracts/docker-container-lifecycle.port';
import {
  DOCKER_NETWORK_RUNTIME,
  type DockerNetworkRuntimePort,
} from '../../../docker/contracts/docker-network-runtime.port';
import {
  DOCKER_RESOURCE_RUNTIME,
  type DockerResourceRuntimePort,
} from '../../../docker/contracts/docker-resource-runtime.port';
import { DockerEngineConfigService } from '../../../config/docker-engine-config.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationProfileStorage } from '../policies/application-profile-storage';
import { AndroidAppsRuntimeNetworkService } from '../../network/services/android-apps-runtime-network.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';

@Injectable()
export class AndroidAppsRemovalCleanupService {
  private readonly logger = new Logger(AndroidAppsRemovalCleanupService.name);

  constructor(
    @Inject(DOCKER_CONTAINER_LIFECYCLE)
    private readonly lifecycle: DockerContainerLifecyclePort,
    @Inject(DOCKER_NETWORK_RUNTIME)
    private readonly networks: DockerNetworkRuntimePort,
    @Inject(DOCKER_RESOURCE_RUNTIME)
    private readonly resources: DockerResourceRuntimePort,
    private readonly dockerConfig: DockerEngineConfigService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
  ) {}

  async cleanup(app: AndroidApplication, removeData: boolean) {
    if (app.containerId) {
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }
    await this.lifecycle.removeContainerByName(app.containerName, app.id);
    await this.networkPolicy.remove(app);
    await this.releaseDisplaySessions(app.id, 'removing');
    await this.runtimeNetwork.releaseRuntimeSupport(app);
    await this.networks.removeNetwork(app.networkName);
    await this.networkPolicy.removeStartupGuard(app.id);

    if (!removeData) {
      return;
    }

    const volumeNames = new ApplicationProfileStorage(
      app,
      this.dockerConfig.resourcePrefix,
    ).trackedVolumes();
    await Promise.all(
      [...volumeNames].map((volumeName) =>
        this.resources.removeVolume(volumeName),
      ),
    );
  }

  async removeRuntimeForRecreation(app: AndroidApplication) {
    await this.releaseDisplaySessions(app.id, 'recreating');
    await this.lifecycle.removeContainerByName(app.containerName, app.id);
    if (app.containerId) {
      await this.lifecycle.removeContainer(app.containerId, {
        applicationId: app.id,
      });
    }
    await this.networkPolicy.remove(app);
    await this.networks.removeNetwork(app.networkName, app.id);
    await this.networkPolicy.removeStartupGuard(app.id);
  }

  releaseDisplaySessions(applicationId: string, operation: string) {
    return this.displaySidecar
      .releaseSessionsForApp(applicationId)
      .catch((error) => {
        this.logger.warn(
          `Could not release display sessions while ${operation} ${applicationId}: ${getErrorMessage(error)}`,
        );
      });
  }
}
