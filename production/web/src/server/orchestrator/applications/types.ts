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

export interface ApplicationRuntimeFilesProfileInput {
  profileMode?: ApplicationProfileMode
  profileName?: string
}

export interface AndroidNotification {
  packageName: string
  title: string
  text: string
  raw: string
}

export interface RunningApplicationNotifications {
  appId: string
  appName: string
  notifications: AndroidNotification[]
}

export interface ApplicationLog {
  source: 'orchestrator' | 'container' | 'adb'
  collectedAt: string
  output: string
}

export interface ApplicationRuntimeFile {
  name: string
  path: string
  sizeBytes: number
  modifiedAt: string | null
}

export interface ApplicationRuntimeFileUpload extends ApplicationRuntimeFile {
  uploaded: boolean
}

export interface ApplicationRuntimeFileDownload {
  name: string
  mimeType: string
  dataUrl: string
}

export interface ApplicationClipboard {
  text: string
  supported: boolean
  message: string | null
}

export interface ApplicationScreenshot {
  mimeType: string
  dataUrl: string
  capturedAt: string
}

export type ApplicationViewerControlCommand =
  | 'back'
  | 'home'
  | 'recents'
  | 'wake'
  | 'power'
  | 'volume-up'
  | 'volume-down'
  | 'mute'
  | 'rotate'
  | 'expand-notifications'
  | 'expand-settings'
  | 'collapse-panels'

export interface ApplicationViewerControlResponse {
  command: ApplicationViewerControlCommand
  executed: boolean
  message: string
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

export type DisplaySessionStatus = 'created' | 'active' | 'released' | 'expired'

export interface DisplaySession {
  id: string
  appId?: string | null
  udid: string
  ownerUserId?: string | null
  status: DisplaySessionStatus
  createdAt: string
  lastActivityAt: string
  expiresAt: string
  capabilities: string[]
  streamPath: string
  viewerPath: string
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
  displaySession: DisplaySession | null
}

export interface UploadedApk {
  id: string
  ownerUserId: string | null
  originalName: string
  sha256: string
  sizeBytes: number
  filePath: string
  extractedIconDataUrl: string | null
  displayName: string | null
  packageName: string | null
  createdAt: string
  updatedAt: string
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
    savedProfiles: Array<{ mode: ApplicationProfileMode; name: string }>
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
    packageName: string | null
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

export type CreateApplicationActionInput = Omit<CreateAndroidApplicationInput, 'ownerUserId'>

export interface CloneApplicationInput {
  ownerUserId?: string
  name?: string
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
