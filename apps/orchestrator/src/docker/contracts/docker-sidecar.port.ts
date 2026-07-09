import type { ServiceHealth, ViewerTargetStatus } from '../docker.types';

export const DOCKER_SIDECAR = Symbol('DOCKER_SIDECAR');

export interface DockerSidecarPort {
  prepareViewerTarget(
    networkName: string,
    adbHost: string,
    adbPort: number,
  ): Promise<ViewerTargetStatus>;
  ensureSidecarOnNetwork(networkName: string): Promise<ViewerTargetStatus>;
  detachSidecarFromNetwork(networkName: string): Promise<void>;
  connectAdb(adbHost: string, adbPort: number): Promise<ViewerTargetStatus>;
  getSidecarIp(networkName: string): Promise<string | null>;
  health(): Promise<ServiceHealth>;
  shallowHealth(): Promise<ServiceHealth>;
  listDisplaySessions(): Promise<unknown>;
  releaseDisplaySession(id: string): Promise<unknown>;
  repair(): Promise<unknown>;
}
