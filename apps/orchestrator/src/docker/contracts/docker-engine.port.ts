import type Dockerode from 'dockerode';
import type { DockerOperationOptions } from './docker-operation-options';

export const DOCKER_ENGINE = Symbol('DOCKER_ENGINE');

export interface DockerEnginePort {
  readonly docker: Dockerode;
  read<T>(
    operation: (signal?: AbortSignal) => Promise<T>,
    description?: string,
    options?: DockerOperationOptions,
  ): Promise<T>;
  longOperation<T>(
    operationName: string,
    description: string,
    operation: (docker: Dockerode, signal: AbortSignal) => Promise<T>,
    timeoutMs?: number,
    options?: DockerOperationOptions & {
      waitForCleanup?: boolean;
      changesInventory?: boolean;
    },
  ): Promise<T>;
  isDockerNotFound(error: unknown): boolean;
  isTransientDockerTransportError(error: unknown): boolean;
}
