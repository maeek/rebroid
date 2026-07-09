import type { DockerPlatformContainersService } from '../containers/services/docker-platform-containers.service';

export const DOCKER_PLATFORM_CONTAINERS = Symbol('DOCKER_PLATFORM_CONTAINERS');

export type DockerPlatformContainersPort = Pick<
  DockerPlatformContainersService,
  keyof DockerPlatformContainersService
>;
