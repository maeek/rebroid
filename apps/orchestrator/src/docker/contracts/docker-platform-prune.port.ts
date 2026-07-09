import type { DockerPlatformPruneService } from '../prune/services/docker-platform-prune.service';

export const DOCKER_PLATFORM_PRUNE = Symbol('DOCKER_PLATFORM_PRUNE');

export type DockerPlatformPrunePort = Pick<
  DockerPlatformPruneService,
  keyof DockerPlatformPruneService
>;
