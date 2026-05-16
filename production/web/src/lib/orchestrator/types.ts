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

export interface OrchestratorHealth {
  ok: boolean
  docker: boolean
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
  status: AndroidApplicationStatus
  lifecycleStage: AndroidApplicationLifecycleStage
  statusMessage: string | null
  containerImage: string
  containerName: string
  containerId: string | null
  networkName: string
  volumeName: string
  profileMode: ApplicationProfileMode
  profileName: string | null
  memoryLimitMb: number | null
  cpuLimitCpus: number | null
  volumeSizeLimitMb: number | null
  containerArgs: string | null
  networkPolicyEnabled: boolean
  networkPolicyAllowCidrs: string
  networkPolicyStatus: string | null
  networkPolicyMessage: string | null
  networkPolicyAppliedAt: string | null
  apkFilePath: string | null
  apkOriginalName: string | null
  uploadedApkId: string | null
  scrcpyTransport: ScrcpyTransport
  adbPort: number
  inactivityTimeoutSeconds: number
  lastScrcpyActivityAt: string | null
  lastStartedAt: string | null
  lastStoppedAt: string | null
  provisioningStartedAt: string | null
  provisioningCompletedAt: string | null
  lastError: string | null
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
