import type { DockerContainerLifecycleService } from '../containers/services/docker-container-lifecycle.service';

export const DOCKER_CONTAINER_LIFECYCLE = Symbol('DOCKER_CONTAINER_LIFECYCLE');

export type DockerContainerLifecyclePort = Pick<
  DockerContainerLifecycleService,
  keyof DockerContainerLifecycleService
>;
