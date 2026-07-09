import type { ServiceHealth } from '../docker.types';

export const DOCKER_HEALTH = Symbol('DOCKER_HEALTH');

export interface DockerHealthPort {
  dockerHealth(): Promise<ServiceHealth>;
  runtimeSuitabilityHealth(): Promise<ServiceHealth>;
  displaySidecarHealth(): Promise<ServiceHealth>;
  dockerHealthSummary(): Promise<ServiceHealth>;
  runtimeSuitabilityHealthSummary(): Promise<ServiceHealth>;
  displaySidecarSummaryHealth(): Promise<ServiceHealth>;
}
