import type { DockerContainerArchiveService } from '../containers/services/docker-container-archive.service';

export const DOCKER_CONTAINER_ARCHIVE = Symbol('DOCKER_CONTAINER_ARCHIVE');

export type DockerContainerArchivePort = Pick<
  DockerContainerArchiveService,
  keyof DockerContainerArchiveService
>;
