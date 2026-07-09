import type Dockerode from 'dockerode';
import type {
  ContainerResourceUsage,
  ManagedContainerResourceUsage,
} from '../docker.types';

export const DOCKER_RESOURCE_RUNTIME = Symbol('DOCKER_RESOURCE_RUNTIME');

export interface DockerResourceRuntimePort {
  readonly hasPendingDockerWork: boolean;
  engineSummary(): Promise<{
    id?: string;
    name?: string;
    serverVersion?: string;
    operatingSystem?: string;
    dockerRootDir?: string;
    cgroupVersion?: string;
    cgroupDriver?: string;
    securityOptions: string[];
  }>;
  hostCapacity(): Promise<{
    memoryBytes: number | null;
    cpuCores: number | null;
    dockerRootDir: string | null;
  }>;
  createVolume(
    applicationId: string,
    volumeName: string,
  ): Promise<Dockerode.Volume | Dockerode.VolumeCreateResponse>;
  removeVolume(volumeName: string): Promise<void>;
  inspectVolume(
    volumeName: string,
  ): Promise<Dockerode.VolumeInspectInfo | null>;
  listManagedContainers(): Promise<Dockerode.ContainerInfo[]>;
  getContainerResourceUsage(
    containerId: string,
  ): Promise<ContainerResourceUsage>;
  getManagedContainerResourceUsage(
    containers?: Dockerode.ContainerInfo[],
  ): Promise<ManagedContainerResourceUsage>;
}
