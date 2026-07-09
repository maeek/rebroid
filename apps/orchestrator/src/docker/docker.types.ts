import { ConflictException } from '@nestjs/common';
import type {
  RuntimeImageMetadata,
  RuntimeImageMetadataSource,
} from '@rebroid/application-core/redroid-runtime';
import { ApplicationProfileMode } from '../android-apps/contracts/application-profile-mode';

export interface ApplicationContainerSpec {
  applicationId: string;
  containerName: string;
  networkName: string;
  volumeName: string;
  image: string;
  dataMountPath: string;
  adbPort: number;
  privileged: boolean;
  profileMode: ApplicationProfileMode;
  memoryLimitMb?: number | null;
  cpuLimitCpus?: number | null;
  containerArgs?: string | null;
  securityOptions?: string[];
  cgroupnsMode?: string | null;
  devices?: string[];
  optionalDevices?: string[];
}

export interface ContainerRuntimeState {
  exists: boolean;
  running: boolean;
  status: string | null;
  exitCode: number | null;
  oomKilled: boolean;
  error: string | null;
  finishedAt: string | null;
}

export interface ManagedContainerResourceUsage {
  cpuUsagePercent: number;
  memoryUsageBytes: number;
}

export interface ContainerResourceUsage extends ManagedContainerResourceUsage {
  memoryLimitBytes: number | null;
  networkRxBytes: number;
  networkTxBytes: number;
  collectedAt: string;
}

export interface PlatformContainer {
  id: string;
  shortId: string;
  names: string[];
  image: string;
  imageId: string;
  command: string;
  createdAt: string;
  state: string;
  status: string;
  labels: Record<string, string>;
  managed: boolean;
  orphaned: boolean;
  applicationId: string | null;
  component: string | null;
  ports: {
    privatePort: number;
    publicPort: number | null;
    type: string;
    ip: string | null;
  }[];
  networks: string[];
}

export interface PlatformContainerLog {
  source: 'container';
  collectedAt: string;
  output: string;
}

export interface PlatformImage {
  id: string;
  shortId: string;
  repoTags: string[];
  repoDigests: string[];
  sizeBytes: number;
  sharedSizeBytes: number;
  virtualSizeBytes: number;
  createdAt: string;
  labels: Record<string, string>;
  managed: boolean;
  containers: number;
  runtimeMetadata?: RuntimeImageMetadata | null;
  runtimeMetadataSource?: RuntimeImageMetadataSource | null;
}

export interface PlatformImageDetails {
  image: PlatformImage;
  inspect: unknown;
  relatedContainers: PlatformContainer[];
}

export interface PlatformNetwork {
  id: string;
  shortId: string;
  name: string;
  driver: string;
  scope: string;
  createdAt: string | null;
  internal: boolean;
  attachable: boolean;
  ingress: boolean;
  labels: Record<string, string>;
  managed: boolean;
  containers: string[];
  subnets: string[];
  gateways: string[];
}

export interface PlatformNetworkDetails {
  network: PlatformNetwork;
  inspect: unknown;
  relatedContainers: PlatformContainer[];
}

export interface PlatformContainerDetails {
  container: PlatformContainer;
  inspect: unknown;
  relatedImage: PlatformImage | null;
  relatedNetworks: PlatformNetwork[];
}

export interface ServiceHealth {
  ok: boolean;
  status: 'healthy' | 'unhealthy' | 'offline';
  message: string;
  details?: Record<string, string | number | boolean | null>;
}

export type ViewerTargetErrorCode =
  | 'sidecar_unavailable'
  | 'adb_missing'
  | 'adb_unreachable'
  | 'unknown';

export interface ViewerTargetError {
  code: ViewerTargetErrorCode;
  message: string;
  retryable: boolean;
  exitCode: number | null;
  command: string[] | null;
  stdout: string | null;
  stderr: string | null;
}

export interface ViewerTargetStatus {
  configured: boolean;
  connected: boolean;
  message: string | null;
  error: ViewerTargetError | null;
}

export interface ContainerCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ContainerCommandFailure {
  message: string;
  command: string[];
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
}

export class ContainerCommandFailedException extends ConflictException {
  constructor(readonly details: ContainerCommandFailure) {
    super(details.message);
  }
}
