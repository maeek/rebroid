import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { getErrorMessage } from '../../../common/error-message';
import { NetworkIsolationService } from '../../../network-isolation/network-isolation.service';
import { NetworkPolicyService } from '../../../network-policy/services/network-policy.service';
import { AndroidApplication } from '../../android-application.entity';
import { parseSavedProfiles } from '../../common/utils/android-apps-profile-history.utils';
import { AndroidAppsRuntimeNetworkService } from '../../network/services/android-apps-runtime-network.service';
import { AndroidAppsDisplaySidecarService } from '../../viewer/services/android-apps-display-sidecar.service';

@Injectable()
export class AndroidAppsRemovalService {
  private readonly logger = new Logger(AndroidAppsRemovalService.name);

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

  async cleanupRemovedApplication(
    app: AndroidApplication,
    removeData: boolean,
  ) {
    if (app?.id) {
      await this.networkPolicy.remove(app);
    } else {
      this.logger.warn(
        'Skipping firewall policy cleanup for removal because application id is missing.',
      );
    }

    if (app.containerId) {
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }

    if (app.containerName) {
      await this.lifecycle.removeContainerByName(app.containerName);
    } else {
      this.logger.warn(
        'Skipping container removal by name because container name is missing.',
      );
    }
    if (app?.id) {
      this.releaseDisplaySessionsInBackground(app.id, 'removing');
    } else {
      this.logger.warn(
        'Skipping display session cleanup during removal because application id is missing.',
      );
    }
    if (app?.id) {
      await this.runtimeNetwork.releaseRuntimeSupport(app);
    } else {
      this.logger.warn(
        'Skipping runtime-sidecar network release during removal because application id is missing.',
      );
    }
    if (app.networkName) {
      await this.networks.removeNetwork(app.networkName);
    } else {
      this.logger.warn(
        'Skipping app network cleanup during removal because network name is missing.',
      );
    }

    if (!removeData) {
      return;
    }

    const volumeNames = new Set([
      app.volumeName,
      ...(app.id
        ? parseSavedProfiles(app.savedProfilesJson).map(
            (profile) =>
              this.networkIsolation.namesFor(app.id, app.name, profile.name)
                .volumeName,
          )
        : []),
    ]);
    await Promise.all(
      [...volumeNames].map((volumeName) =>
        this.resources.removeVolume(volumeName),
      ),
    );
  }

  releaseDisplaySessionsInBackground(applicationId: string, operation: string) {
    if (!applicationId) {
      this.logger.warn(
        `Could not release display sessions while ${operation}: application id is missing.`,
      );
      return;
    }

    void this.displaySidecar
      .releaseSessionsForApp(applicationId)
      .catch((error) => {
        this.logger.warn(
          `Could not release display sessions while ${operation} ${applicationId}: ${getErrorMessage(error)}`,
        );
      });
  }
}
