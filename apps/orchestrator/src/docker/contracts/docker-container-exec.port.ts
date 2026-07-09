import type { DockerContainerExecService } from '../containers/services/docker-container-exec.service';

export const DOCKER_CONTAINER_EXEC = Symbol('DOCKER_CONTAINER_EXEC');

export type DockerContainerExecPort = Pick<
  DockerContainerExecService,
  keyof DockerContainerExecService
>;
