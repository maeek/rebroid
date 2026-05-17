export const ORCHESTRATOR_OWNER_USER_ID = 'admin'

export type AndroidApplicationStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'removing' | 'removed'

export type AndroidApplicationLifecycleStage =
  | 'queued'
  | 'image_checking'
  | 'image_pulling'
  | 'volume_creating'
  | 'network_creating'
  | 'orchestrator_network_connecting'
  | 'container_creating'
  | 'container_starting'
  | 'android_booting'
  | 'apk_installing'
  | 'ready'
  | 'stopping'
  | 'stopped'
  | 'removing'
  | 'removed'
  | 'error'

export type ScrcpyTransport = 'websocket'
export type ApplicationProfileMode = 'persistent' | 'temporary'

export interface AndroidNotification {
  packageName: string
  title: string
  text: string
  raw: string
}

export interface ApplicationLog {
  source: 'container' | 'adb'
  collectedAt: string
  output: string
}

export type ScrcpyViewerErrorCode = 'sidecar_unavailable' | 'adb_missing' | 'adb_unreachable' | 'unknown'

export interface ScrcpyViewerError {
  code: ScrcpyViewerErrorCode
  message: string
  retryable: boolean
  exitCode: number | null
  command: string[] | null
  stdout: string | null
  stderr: string | null
}

export interface AndroidImagePullProgress {
  status: string
  current: string
  total: string
  layerId: string | null
  percent: number
}

export type AndroidApplicationErrorCode =
  | 'container_command_failed'
  | 'container_exited'
  | 'container_missing'
  | 'startup_command_finished'
  | 'unknown'

export interface AndroidApplicationError {
  code: AndroidApplicationErrorCode
  phase: 'provisioning' | 'runtime' | 'unknown'
  message: string
  retryable: boolean
  exitCode: number | null
  hint: string | null
}

export type AndroidApplicationStatusDetailCode =
  | 'queued'
  | 'image_checking'
  | 'image_pulling'
  | 'volume_creating'
  | 'network_creating'
  | 'orchestrator_network_connecting'
  | 'container_creating'
  | 'container_starting'
  | 'android_booting'
  | 'apk_installing'
  | 'ready'
  | 'stopping'
  | 'stopped'
  | 'stopped_recreate_required'
  | 'removing'
  | 'removed'
  | 'error'
  | 'unknown'

export interface AndroidApplicationStatusDetail {
  code: AndroidApplicationStatusDetailCode
  title: string
  description: string | null
  tone: 'neutral' | 'progress' | 'success' | 'warning' | 'error'
}

export type AndroidNetworkPolicyResultCode =
  | 'applied'
  | 'apply_failed'
  | 'container_ip_unavailable'
  | 'container_not_created'
  | 'iptables_disabled'
  | 'policy_disabled'
  | 'unknown'

export interface AndroidNetworkPolicyResult {
  status: 'applied' | 'skipped' | 'error'
  code: AndroidNetworkPolicyResultCode
  message: string
  hint: string | null
}

export interface ScrcpySession {
  applicationId: string
  transport: ScrcpyTransport
  udid: string
  proxyRemote: string
  player: string
  viewerServiceConfigured: boolean
  viewerTargetConnected: boolean
  viewerMessage: string | null
  viewerError: ScrcpyViewerError | null
  adbHost: string
  adbPort: number
}

export interface SystemResources {
  containersTotal: number
  containersRunning: number
  containersStopped: number
  managedContainersCpuUsagePercent: number
  managedContainersMemoryUsageBytes: number
  containerStatsCollectedAt: string | null
  managedVolumesTotal: number
  managedVolumesSizeBytes: number
  volumeUsageCachedAt: string | null
  containers: Array<{ id: string; name: string; state: string; status: string }>
  volumes: Array<{ name: string; sizeBytes: number | null }>
}

export interface PlatformContainer {
  id: string
  shortId: string
  names: string[]
  image: string
  imageId: string
  command: string
  createdAt: string
  state: string
  status: string
  labels: Record<string, string>
  managed: boolean
  applicationId: string | null
  component: string | null
  ports: Array<{ privatePort: number; publicPort: number | null; type: string; ip: string | null }>
  networks: string[]
}

export interface PlatformContainerLog {
  source: 'container'
  collectedAt: string
  output: string
}

export interface PlatformImage {
  id: string
  shortId: string
  repoTags: string[]
  repoDigests: string[]
  sizeBytes: number
  sharedSizeBytes: number
  virtualSizeBytes: number
  createdAt: string
  labels: Record<string, string>
  containers: number
}

export interface PlatformImageDetails {
  image: PlatformImage
  inspect: unknown
  relatedContainers: PlatformContainer[]
}

export interface PlatformNetwork {
  id: string
  shortId: string
  name: string
  driver: string
  scope: string
  createdAt: string | null
  internal: boolean
  attachable: boolean
  ingress: boolean
  labels: Record<string, string>
  managed: boolean
  containers: string[]
  subnets: string[]
  gateways: string[]
}

export interface PlatformNetworkDetails {
  network: PlatformNetwork
  inspect: unknown
  relatedContainers: PlatformContainer[]
}

export interface PlatformContainerDetails {
  container: PlatformContainer
  inspect: unknown
  relatedImage: PlatformImage | null
  relatedNetworks: PlatformNetwork[]
}

export interface OrchestratorHealth {
  ok: boolean
  docker: boolean
  scrcpy: boolean
  services: {
    orchestrator: ServiceHealth
    docker: ServiceHealth
    scrcpy: ServiceHealth
  }
}

export interface ServiceHealth {
  ok: boolean
  status: 'healthy' | 'unhealthy' | 'offline'
  message: string
  details?: Record<string, string | number | boolean | null>
}

export interface DockerPruneResponse {
  ContainersDeleted?: string[]
  ImagesDeleted?: Array<{ Deleted?: string; Untagged?: string }>
  NetworksDeleted?: string[]
  VolumesDeleted?: string[]
  SpaceReclaimed?: number
}

export interface DockerPruneAllResponse {
  containers: DockerPruneResponse
  networks: DockerPruneResponse
  images: DockerPruneResponse
  volumes: DockerPruneResponse
}

export interface UploadedApk {
  id: string
  ownerUserId: string | null
  originalName: string
  sha256: string
  sizeBytes: number
  filePath: string
  extractedIconDataUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CleanupUploadedApksResponse {
  deletedRecords: number
  removedFiles: number
}

export interface AndroidApplication {
  id: string
  name: string
  ownerUserId: string | null
  status: {
    currentStatus: AndroidApplicationStatus
    lifecycleStage: AndroidApplicationLifecycleStage
    message: string | null
    detail: AndroidApplicationStatusDetail | null
    progress: AndroidImagePullProgress | null
    recreateRequired: boolean
    lastScrcpyActivityAt: string | null
    lastStartedAt: string | null
    lastStoppedAt: string | null
    provisioningStartedAt: string | null
    provisioningCompletedAt: string | null
  }
  errors: {
    lastError: string | null
    application: AndroidApplicationError | null
  }
  runtime: {
    image: string
    containerName: string
    containerId: string | null
    containerArgs: string | null
    adbPort: number
    scrcpyTransport: ScrcpyTransport
    inactivityTimeoutSeconds: number
    resources: {
      memoryLimitMb: number | null
      cpuLimitCpus: number | null
      volumeSizeLimitMb: number | null
    }
  }
  storage: {
    volumeName: string
    profileMode: ApplicationProfileMode
    profileName: string | null
  }
  network: {
    networkName: string
    policy: {
      enabled: boolean
      allowCidrs: string[]
      status: string | null
      message: string | null
      result: AndroidNetworkPolicyResult | null
      appliedAt: string | null
    }
  }
  apk: {
    filePath: string | null
    originalName: string | null
    uploadedApkId: string | null
  }
  createdAt: string
  updatedAt: string
}

export interface CreateAndroidApplicationInput {
  name: string
  ownerUserId?: string
  containerImage?: string
  inactivityTimeoutSeconds?: number
  memoryLimitMb?: number
  cpuLimitCpus?: number
  volumeSizeLimitMb?: number
  containerArgs?: string
  uploadedApkId?: string
}

export interface UpdateAndroidApplicationInput {
  name?: string
  ownerUserId?: string
  inactivityTimeoutSeconds?: number
  memoryLimitMb?: number | null
  cpuLimitCpus?: number | null
  volumeSizeLimitMb?: number | null
  containerArgs?: string | null
}

export interface UpdateNetworkPolicyInput {
  networkPolicyEnabled?: boolean
  networkPolicyAllowCidrs?: string[]
}

export interface SwitchApplicationProfileInput {
  profileMode?: ApplicationProfileMode
  profileName?: string
}

export interface DeleteAndroidApplicationResponse {
  id: string
  deleted: boolean
  removedData: boolean
}
