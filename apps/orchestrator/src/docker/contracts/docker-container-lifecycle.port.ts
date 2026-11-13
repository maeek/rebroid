import type { DockerOperationOptions } from './docker-operation-options';
import type Dockerode from 'dockerode';
import type { ContainerRuntimeState } from '../docker.types';

export const DOCKER_CONTAINER_LIFECYCLE = Symbol('DOCKER_CONTAINER_LIFECYCLE');

export interface DockerContainerLifecyclePort {
  inspectContainer(
    containerId: string,
    options?: DockerOperationOptions,
  ): Promise<Dockerode.ContainerInspectInfo>;
  findContainerByName(
    name: string,
    applicationId?: string,
    options?: DockerOperationOptions,
  ): Promise<Dockerode.ContainerInfo | undefined>;
  getContainerRuntimeState(
    containerId: string,
    options?: DockerOperationOptions,
  ): Promise<ContainerRuntimeState>;
  getContainerLogs(
    containerId: string,
    tail?: number,
    options?: DockerOperationOptions,
  ): Promise<string>;
  startContainer(
    containerId: string,
    options?: DockerOperationOptions,
  ): Promise<void>;
  stopContainer(containerId: string, timeoutSeconds?: number): Promise<void>;
  removeContainer(
    containerId: string,
    options?: {
      force?: boolean;
      removeVolumes?: boolean;
      maxAttempts?: number;
      retryDelayMs?: number;
      applicationId?: string;
    },
  ): Promise<void>;
  removeContainerByName(
    containerName: string,
    applicationId?: string,
  ): Promise<void>;
}
