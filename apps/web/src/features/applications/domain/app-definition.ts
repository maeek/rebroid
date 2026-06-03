import type {
  AndroidApplicationError,
  AndroidApplicationLifecycleStage,
  AndroidApplicationStatus,
  AndroidApplicationStatusDetail,
  AndroidImagePullProgress,
  AndroidNetworkPolicyResult,
  ApplicationProfileMode,
  ScrcpyTransport
} from '@/server/orchestrator/applications/types'

export interface AppDefinition {
  id: string
  name: string
  icon: string | null
  running: boolean
  status: AndroidApplicationStatus
  lifecycleStage: AndroidApplicationLifecycleStage
  statusMessage: string | null
  statusDetail: AndroidApplicationStatusDetail | null
  ownerUserId: string | null
  ownerDisplayName?: string | null
  containerImage: string
  containerName: string
  containerId: string | null
  networkName: string
  volumeName: string
  profileName: string | null
  memoryLimitMb: number | null
  cpuLimitCpus: number | null
  containerArgs: string | null
  recreateContainerOnNextStart: boolean
  networkPolicyEnabled: boolean
  networkPolicyAllowCidrs: string[]
  networkPolicyStatus: string | null
  networkPolicyMessage: string | null
  networkPolicyResult: AndroidNetworkPolicyResult | null
  networkPolicyAppliedAt: Date | null
  apkOriginalName: string | null
  apkPackageName: string | null
  apkFilePath: string | null
  uploadedApkId: string | null
  scrcpyTransport: ScrcpyTransport
  adbPort: number
  inactivityTimeoutSeconds: number
  lastError: string | null
  lastStartedAt?: Date
  lastStoppedAt?: Date
  provisioningStartedAt?: Date
  provisioningCompletedAt?: Date
  createdAt: Date
  updatedAt: Date
  imagePullProgress: AndroidImagePullProgress | null
  applicationError: AndroidApplicationError | null
  apk: {
    version: string
    newVersion?: string
  }
  container?: {
    persistentStorage?: boolean
    internetAccess?: boolean
  }
  runtime?: {
    version: string
    arguments?: string
  }
  profileMode: ApplicationProfileMode
  savedProfiles: Array<{ mode: ApplicationProfileMode; name: string }>
}

export const yourApps = [] as AppDefinition[]
