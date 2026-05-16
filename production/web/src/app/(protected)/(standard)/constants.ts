import { IconApps, IconLibraryPlusFilled, IconAdjustments, IconBrandDocker, IconServerSpark } from '@tabler/icons-react'

export interface AppDefinition {
  id: string
  name: string
  icon: string | null
  running: boolean
  status: 'provisioning' | 'running' | 'stopped' | 'error' | 'removing' | 'removed'
  lifecycleStage:
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
  statusMessage: string | null
  ownerUserId: string | null
  containerImage: string
  containerName: string
  containerId: string | null
  networkName: string
  volumeName: string
  profileMode: 'persistent' | 'temporary'
  profileName: string | null
  memoryLimitMb: number | null
  cpuLimitCpus: number | null
  volumeSizeLimitMb: number | null
  containerArgs: string | null
  networkPolicyEnabled: boolean
  networkPolicyAllowCidrs: string[]
  networkPolicyStatus: string | null
  networkPolicyMessage: string | null
  networkPolicyAppliedAt: Date | null
  apkOriginalName: string | null
  apkFilePath: string | null
  uploadedApkId: string | null
  scrcpyTransport: 'websocket'
  adbPort: number
  inactivityTimeoutSeconds: number
  lastError: string | null
  lastStartedAt?: Date
  lastStoppedAt?: Date
  provisioningStartedAt?: Date
  provisioningCompletedAt?: Date
  createdAt: Date
  updatedAt: Date
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
}

export const yourApps = [] as AppDefinition[]

export const appsSections = [
  { name: 'Installed Apps', Icon: IconApps, href: '/apps' },
  { name: 'Add New App', Icon: IconLibraryPlusFilled, href: '/apps/create' }
] as const

export const settingsSections = [
  { name: 'General', Icon: IconAdjustments, href: '/settings/general' },
  { name: 'Orchestrator', Icon: IconBrandDocker, href: '/settings/orchestrator' },
  { name: 'System', Icon: IconServerSpark, href: '/settings/system' }
] as const
