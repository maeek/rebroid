import type { ContainerCommandResult } from '../docker.types';
import type { DockerOperationOptions } from './docker-operation-options';

export const DOCKER_CONTAINER_EXEC = Symbol('DOCKER_CONTAINER_EXEC');

export interface DockerContainerExecOptions extends DockerOperationOptions {
  timeoutMs?: number;
  /** Wrap a mutating guest command in timeout and drain its admitted execution. */
  guestTimeoutMs?: number;
}

export interface DockerContainerExecPort {
  execInContainer(
    containerId: string,
    command: string[],
    options?: DockerContainerExecOptions,
  ): Promise<void>;
  execInContainerWithOutput(
    containerId: string,
    command: string[],
    options?: DockerContainerExecOptions,
  ): Promise<ContainerCommandResult>;
}
