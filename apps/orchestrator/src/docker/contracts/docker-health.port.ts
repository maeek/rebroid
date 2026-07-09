import type { DockerHealthService } from '../health/services/docker-health.service';

export const DOCKER_HEALTH = Symbol('DOCKER_HEALTH');

export type DockerHealthPort = Pick<
  DockerHealthService,
  keyof DockerHealthService
>;
