import type { ContainerCommandResult } from '../docker.types';
import type { OperationDeadline } from '../../common/operation-deadline';

export const DOCKER_CONTAINER_EXEC = Symbol('DOCKER_CONTAINER_EXEC');

export interface DockerContainerExecOptions {
  timeoutMs?: number;
  deadline?: OperationDeadline;
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
