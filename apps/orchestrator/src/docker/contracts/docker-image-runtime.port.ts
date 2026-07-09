import type { DockerImageRuntimeService } from '../images/services/docker-image-runtime.service';

export const DOCKER_IMAGE_RUNTIME = Symbol('DOCKER_IMAGE_RUNTIME');

export type DockerImageRuntimePort = Pick<
  DockerImageRuntimeService,
  keyof DockerImageRuntimeService
>;
