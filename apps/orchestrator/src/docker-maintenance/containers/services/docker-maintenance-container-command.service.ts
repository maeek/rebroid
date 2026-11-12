import { Inject, Injectable } from '@nestjs/common';
import { AndroidAppsService } from '../../../android-apps/common/android-apps.service';
import {
  DOCKER_PLATFORM_CONTAINERS,
  type AdmitPlatformContainerChange,
  type DockerPlatformContainersPort,
} from '../../../docker/contracts/docker-platform-containers.port';

@Injectable()
export class DockerMaintenanceContainerCommandService {
  constructor(
    @Inject(DOCKER_PLATFORM_CONTAINERS)
    private readonly containers: DockerPlatformContainersPort,
    private readonly applications: AndroidAppsService,
  ) {}

  stop(id: string) {
    return this.containers.stopPlatformContainer(id, this.admit);
  }

  remove(id: string, force: boolean) {
    return this.containers.removePlatformContainer(id, force, this.admit);
  }

  private readonly admit: AdmitPlatformContainerChange = (target, operation) =>
    target.applicationId
      ? this.applications.applyPlatformContainerChange(
          target.applicationId,
          target.id,
          operation,
        )
      : operation();
}
