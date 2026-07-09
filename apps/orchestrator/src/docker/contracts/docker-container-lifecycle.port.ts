import type Dockerode from 'dockerode';
import type { ContainerRuntimeState } from '../docker.types';

export const DOCKER_CONTAINER_LIFECYCLE = Symbol('DOCKER_CONTAINER_LIFECYCLE');

export interface DockerContainerLifecyclePort {
  inspectContainer(
    containerId: string,
  ): Promise<Dockerode.ContainerInspectInfo>;
  findContainerByName(
    name: string,
  ): Promise<Dockerode.ContainerInfo | undefined>;
  getContainerRuntimeState(containerId: string): Promise<ContainerRuntimeState>;
  getContainerLogs(containerId: string, tail?: number): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string, timeoutSeconds?: number): Promise<void>;
  removeContainer(
    containerId: string,
    options?: {
      force?: boolean;
      removeVolumes?: boolean;
      maxAttempts?: number;
      retryDelayMs?: number;
    },
  ): Promise<void>;
  removeContainerByName(containerName: string): Promise<void>;
}
