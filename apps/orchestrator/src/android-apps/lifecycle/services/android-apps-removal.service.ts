import { Injectable, Logger } from '@nestjs/common';
import { DockerContainerLifecycleService } from '../../../docker/containers/services/docker-container-lifecycle.service';
import { DockerNetworkRuntimeService } from '../../../docker/networks/services/docker-network-runtime.service';
import { DockerResourceRuntimeService } from '../../../docker/resources/services/docker-resource-runtime.service';
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
    private readonly lifecycle: DockerContainerLifecycleService,
    private readonly networks: DockerNetworkRuntimeService,
    private readonly resources: DockerResourceRuntimeService,
    private readonly networkIsolation: NetworkIsolationService,
    private readonly networkPolicy: NetworkPolicyService,
    private readonly runtimeNetwork: AndroidAppsRuntimeNetworkService,
    private readonly displaySidecar: AndroidAppsDisplaySidecarService,
  ) {}

  async cleanupRemovedApplication(
    app: AndroidApplication,
    removeData: boolean,
  ) {
    await this.networkPolicy.remove(app);
    if (app.containerId) {
      await this.lifecycle.removeContainer(app.containerId);
      app.containerId = null;
    }
    await this.lifecycle.removeContainerByName(app.containerName);
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

  releaseDisplaySessionsInBackground(applicationId: string, operation: string) {
    void this.displaySidecar
      .releaseSessionsForApp(applicationId)
      .catch((error) => {
        this.logger.warn(
          `Could not release display sessions while ${operation} ${applicationId}: ${getErrorMessage(error)}`,
        );
      });
  }
}
