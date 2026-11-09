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
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { parseSavedProfiles } from '../../common/utils/android-apps-profile-history.utils';
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
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
  ) {}

  async cleanup(app: AndroidApplication, removeData: boolean) {
    if (app.containerId) {
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }
    await this.lifecycle.removeContainerByName(app.containerName);
    await this.networkPolicy.remove(app);
    this.releaseDisplaySessionsInBackground(app.id, 'removing');
    await this.runtimeNetwork.releaseRuntimeSupport(app);
    await this.networks.removeNetwork(app.networkName);

    if (!removeData) {
      return;
    }

    const volumeNames = new Set([
      app.volumeName,
      ...parseSavedProfiles(app.savedProfilesJson).map(
        (profile) =>
          this.networkIsolation.namesFor(app.id, app.name, profile.name)
            .volumeName,
      ),
    ]);
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
  }

  releaseDisplaySessionsInBackground(applicationId: string, operation: string) {
    void this.releaseDisplaySessions(applicationId, operation);
  }

  private releaseDisplaySessions(applicationId: string, operation: string) {
    return this.displaySidecar
      .releaseSessionsForApp(applicationId)
      .catch((error) => {
        this.logger.warn(
          `Could not release display sessions while ${operation} ${applicationId}: ${getErrorMessage(error)}`,
        );
      });
  }
}
