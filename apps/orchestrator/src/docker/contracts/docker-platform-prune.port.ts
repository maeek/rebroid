export const DOCKER_PLATFORM_PRUNE = Symbol('DOCKER_PLATFORM_PRUNE');

export interface DockerPlatformPrunePort {
  isBusy(): boolean;
  pruneImages(danglingOnly?: boolean): Promise<unknown>;
  pruneContainers(): Promise<unknown>;
  pruneNetworks(): Promise<unknown>;
  pruneVolumes(): Promise<unknown>;
}
