import { AppDefinition } from '@/app/(protected)/(standard)/constants'
import { AndroidApplication } from './types'

export const isApplicationRunning = (app: AndroidApplication) => app.status === 'running'

const parseAllowCidrs = (value: string) => {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const mapAndroidApplicationToAppDefinition = (app: AndroidApplication): AppDefinition => ({
  id: app.id,
  name: app.name,
  icon: null,
  running: isApplicationRunning(app),
  status: app.status,
  lifecycleStage: app.lifecycleStage,
  statusMessage: app.statusMessage,
  ownerUserId: app.ownerUserId,
  redroidImage: app.redroidImage,
  containerName: app.containerName,
  containerId: app.containerId,
  networkName: app.networkName,
  volumeName: app.volumeName,
  profileMode: app.profileMode,
  profileName: app.profileName,
  memoryLimitMb: app.memoryLimitMb,
  cpuLimitCpus: app.cpuLimitCpus,
  volumeSizeLimitMb: app.volumeSizeLimitMb,
  redroidArgs: app.redroidArgs,
  networkPolicyEnabled: app.networkPolicyEnabled,
  networkPolicyAllowCidrs: parseAllowCidrs(app.networkPolicyAllowCidrs),
  networkPolicyStatus: app.networkPolicyStatus,
  networkPolicyMessage: app.networkPolicyMessage,
  networkPolicyAppliedAt: app.networkPolicyAppliedAt ? new Date(app.networkPolicyAppliedAt) : null,
  apkOriginalName: app.apkOriginalName,
  apkFilePath: app.apkFilePath,
  scrcpyTransport: app.scrcpyTransport,
  adbPort: app.adbPort,
  inactivityTimeoutSeconds: app.inactivityTimeoutSeconds,
  lastError: app.lastError,
  lastStartedAt: app.lastStartedAt ? new Date(app.lastStartedAt) : undefined,
  lastStoppedAt: app.lastStoppedAt ? new Date(app.lastStoppedAt) : undefined,
  provisioningStartedAt: app.provisioningStartedAt ? new Date(app.provisioningStartedAt) : undefined,
  provisioningCompletedAt: app.provisioningCompletedAt ? new Date(app.provisioningCompletedAt) : undefined,
  createdAt: new Date(app.createdAt),
  updatedAt: new Date(app.updatedAt),
  apk: {
    version: app.apkOriginalName ?? 'Unknown'
  },
  container: {
    persistentStorage: app.profileMode === 'persistent',
    internetAccess: app.networkPolicyAllowCidrs !== '[]'
  },
  redroid: {
    version: app.redroidImage,
    arguments: app.redroidArgs ?? undefined
  }
})
