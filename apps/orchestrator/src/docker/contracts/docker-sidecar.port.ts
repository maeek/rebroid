import type { DockerSidecarService } from '../sidecar/services/docker-sidecar.service';

export const DOCKER_SIDECAR = Symbol('DOCKER_SIDECAR');

export type DockerSidecarPort = Pick<
  DockerSidecarService,
  keyof DockerSidecarService
>;
