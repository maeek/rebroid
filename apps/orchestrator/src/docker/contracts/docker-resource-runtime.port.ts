import type { DockerResourceRuntimeService } from '../resources/services/docker-resource-runtime.service';

export const DOCKER_RESOURCE_RUNTIME = Symbol('DOCKER_RESOURCE_RUNTIME');

export type DockerResourceRuntimePort = Pick<
  DockerResourceRuntimeService,
  keyof DockerResourceRuntimeService
>;
