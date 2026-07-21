import { Inject, Injectable } from '@nestjs/common';
import {
  ANDROID_APPS_RUNTIME_INVENTORY,
  type AndroidAppsRuntimeInventoryPort,
} from '../../../android-apps/contracts/android-apps-runtime-inventory.port';
import {
  DOCKER_PLATFORM_CONTAINERS,
  type DockerPlatformContainersPort,
} from '../../../docker/contracts/docker-platform-containers.port';
import type { PlatformContainer } from '../../../docker/docker.types';

@Injectable()
export class DockerMaintenanceContainerQueryService {
  constructor(
    @Inject(DOCKER_PLATFORM_CONTAINERS)
    private readonly containers: DockerPlatformContainersPort,
    @Inject(ANDROID_APPS_RUNTIME_INVENTORY)
    private readonly applications: AndroidAppsRuntimeInventoryPort,
  ) {}

  async listContainers() {
    return this.markOrphaned(await this.containers.listPlatformContainers());
  }

  async getContainer(id: string) {
    const details = await this.containers.getPlatformContainerDetails(id);
    const [container] = await this.markOrphaned([details.container]);
    return { ...details, container };
  }

  private async markOrphaned(containers: PlatformContainer[]) {
    const applicationIds = [
      ...new Set(
        containers.flatMap((container) =>
          container.managed && container.applicationId
            ? [container.applicationId]
            : [],
        ),
      ),
    ];
    if (applicationIds.length === 0) {
      return containers;
    }

    const existing = await this.applications.findExistingIds(applicationIds);
    return containers.map((container) => ({
      ...container,
      orphaned:
        container.managed &&
        container.applicationId !== null &&
        !existing.has(container.applicationId),
    }));
  }
}
