import type { ContainerCommandResult } from '../docker.types';

export const DOCKER_CONTAINER_EXEC = Symbol('DOCKER_CONTAINER_EXEC');

export interface DockerContainerExecPort {
  execInContainer(
    containerId: string,
    command: string[],
    options?: { timeoutMs?: number },
  ): Promise<void>;
  execInContainerWithOutput(
    containerId: string,
    command: string[],
    options?: { timeoutMs?: number },
  ): Promise<ContainerCommandResult>;
}
