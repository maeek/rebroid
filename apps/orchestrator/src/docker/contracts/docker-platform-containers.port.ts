import type {
  ContainerResourceUsage,
  PlatformContainer,
  PlatformContainerDetails,
  PlatformContainerLog,
} from '../docker.types';

export const DOCKER_PLATFORM_CONTAINERS = Symbol('DOCKER_PLATFORM_CONTAINERS');

export type AdmitPlatformContainerChange = (
  target: { id: string; applicationId: string | null },
  operation: () => Promise<void>,
) => Promise<void>;

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
    admit: AdmitPlatformContainerChange,
  ): Promise<{ id: string; stopped: boolean }>;
  removePlatformContainer(
    containerId: string,
    force: boolean,
    admit: AdmitPlatformContainerChange,
  ): Promise<{ id: string; removed: boolean }>;
}
