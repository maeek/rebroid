import type { DockerNetworkAttachmentTimings } from './docker-network-runtime.port';
import type { ServiceHealth, ViewerTargetStatus } from '../docker.types';
import type { OperationDeadline } from '../../common/operation-deadline';

export interface DockerSidecarAttachmentTimings extends DockerNetworkAttachmentTimings {
  sidecarQueueMs: number;
  sidecarPreparationMs: number;
  networkInspectMs: number;
  sidecarContainerId?: string;
  sidecarNetworkCountBefore?: number;
  sidecarPublishedPortCount?: number;
  sidecarPublishedBindingCount?: number;
}

export const DOCKER_SIDECAR = Symbol('DOCKER_SIDECAR');

export interface DockerSidecarPort {
  readonly adbTargetGeneration: number;
  prepareViewerTarget(
    networkName: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus>;
  ensureSidecarOnNetwork(
    networkName: string,
    deadline?: OperationDeadline,
    timings?: DockerSidecarAttachmentTimings,
    signal?: AbortSignal,
  ): Promise<ViewerTargetStatus & { sidecarGeneration: number }>;
  detachSidecarFromNetwork(networkName: string): Promise<void>;
  connectAdb(
    adbHost: string,
    adbPort: number,
    deadline?: OperationDeadline,
    signal?: AbortSignal,
  ): Promise<ViewerTargetStatus>;
  getSidecarIp(networkName: string): Promise<string | null>;
  health(): Promise<ServiceHealth>;
  shallowHealth(): Promise<ServiceHealth>;
  listDisplaySessions(): Promise<unknown>;
  releaseDisplaySession(id: string): Promise<unknown>;
  repair(): Promise<unknown>;
}
