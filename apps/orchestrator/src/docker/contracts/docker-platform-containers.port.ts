import type {
  ContainerResourceUsage,
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
} from '../docker.types';

export const DOCKER_PLATFORM_CONTAINERS = Symbol('DOCKER_PLATFORM_CONTAINERS');

export interface DockerPlatformContainersPort {
  listPlatformContainers(): Promise<PlatformContainer[]>;
  getPlatformContainerDetails(
    containerId: string,
  ): Promise<PlatformContainerDetails>;
  getPlatformContainerLogs(
    containerId: string,
    tail?: number,
  ): Promise<PlatformContainerLog>;
  getPlatformContainerStats(
    containerId: string,
  ): Promise<ContainerResourceUsage>;
  stopPlatformContainer(
    containerId: string,
  ): Promise<{ id: string; stopped: boolean }>;
  removePlatformContainer(
    containerId: string,
    force?: boolean,
  ): Promise<{ id: string; removed: boolean }>;
}
