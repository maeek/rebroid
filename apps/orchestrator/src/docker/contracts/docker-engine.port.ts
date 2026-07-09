import type Dockerode from 'dockerode';

export const DOCKER_ENGINE = Symbol('DOCKER_ENGINE');

export interface DockerEngineInfo extends Record<string, unknown> {
  ID?: string;
  Name?: string;
  ServerVersion?: string;
  OperatingSystem?: string;
  DockerRootDir?: string;
  CgroupVersion?: string;
  CgroupDriver?: string;
  SecurityOptions?: string[];
  MemTotal?: number;
  NCPU?: number;
}

export interface DockerEnginePort {
  readonly docker: Dockerode;
  readonly streamDocker: Dockerode;
  readonly resourcePrefix: string;
  readonly orchestratorContainerId?: string;
  readonly transport: string;
  readonly hasPendingMutations: boolean;
  readonly hasPendingDockerWork: boolean;
  ping(): Promise<unknown>;
  info(): Promise<DockerEngineInfo>;
  read<T>(operation: () => Promise<T>, description?: string): Promise<T>;
  coalesceRead<T>(
    key: string,
    operation: () => Promise<T>,
    description?: string,
  ): Promise<T>;
  mutate<T>(operation: () => Promise<T>, description?: string): Promise<T>;
  longOperation<T>(
    operationName: string,
    description: string,
    operation: (docker: Dockerode, signal: AbortSignal) => Promise<T>,
    timeoutMs?: number,
  ): Promise<T>;
  labels(applicationId: string, component: string): Record<string, string>;
  isDockerConflict(error: unknown): boolean;
  isDockerForbidden(error: unknown): boolean;
  isDockerNotFound(error: unknown): boolean;
  isDockerNotModified(error: unknown): boolean;
  isContainerAlreadyConnectedToNetwork(error: unknown): boolean;
  isContainerAlreadyDisconnectedFromNetwork(error: unknown): boolean;
  isContainerRemovalInProgress(error: unknown): boolean;
  isResourceAlreadyExists(error: unknown): boolean;
  isTransientDockerTransportError(error: unknown): boolean;
  errorMessage(error: unknown): string;
}
