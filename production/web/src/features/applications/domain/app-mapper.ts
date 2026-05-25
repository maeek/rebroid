import { AppDefinition } from '@/features/applications/domain/app-definition'
import type { AndroidApplication } from '@/server/orchestrator/applications/types'

export const isApplicationRunning = (app: AndroidApplication) => app.status.currentStatus === 'running'

export const mapAndroidApplicationToAppDefinition = (app: AndroidApplication): AppDefinition => ({
  id: app.id,
  name: app.name,
  icon: null,
  running: isApplicationRunning(app),
  status: app.status.currentStatus,
  lifecycleStage: app.status.lifecycleStage,
  statusMessage: app.status.message,
  statusDetail: app.status.detail,
  ownerUserId: app.ownerUserId,
  containerImage: app.runtime.image,
  containerName: app.runtime.containerName,
  containerId: app.runtime.containerId,
  networkName: app.network.networkName,
  volumeName: app.storage.volumeName,
  profileMode: app.storage.profileMode,
  profileName: app.storage.profileName,
  savedProfiles: app.storage.savedProfiles ?? [],
  memoryLimitMb: app.runtime.resources.memoryLimitMb,
  cpuLimitCpus: app.runtime.resources.cpuLimitCpus,
  volumeSizeLimitMb: app.runtime.resources.volumeSizeLimitMb,
  containerArgs: app.runtime.containerArgs,
  recreateContainerOnNextStart: app.status.recreateRequired,
  networkPolicyEnabled: app.network.policy.enabled,
  networkPolicyAllowCidrs: app.network.policy.allowCidrs,
  networkPolicyStatus: app.network.policy.status,
  networkPolicyMessage: app.network.policy.message,
  networkPolicyResult: app.network.policy.result,
  networkPolicyAppliedAt: app.network.policy.appliedAt ? new Date(app.network.policy.appliedAt) : null,
  apkOriginalName: app.apk.originalName,
  apkFilePath: app.apk.filePath,
  uploadedApkId: app.apk.uploadedApkId,
  scrcpyTransport: app.runtime.scrcpyTransport,
  adbPort: app.runtime.adbPort,
  inactivityTimeoutSeconds: app.runtime.inactivityTimeoutSeconds,
  lastError: app.errors.lastError,
  lastStartedAt: app.status.lastStartedAt ? new Date(app.status.lastStartedAt) : undefined,
  lastStoppedAt: app.status.lastStoppedAt ? new Date(app.status.lastStoppedAt) : undefined,
  provisioningStartedAt: app.status.provisioningStartedAt ? new Date(app.status.provisioningStartedAt) : undefined,
  provisioningCompletedAt: app.status.provisioningCompletedAt
    ? new Date(app.status.provisioningCompletedAt)
    : undefined,
  createdAt: new Date(app.createdAt),
  updatedAt: new Date(app.updatedAt),
  imagePullProgress: app.status.progress,
  applicationError: app.errors.application,
  apk: {
    version: app.apk.originalName ?? 'Unknown'
  },
  container: {
    persistentStorage: app.storage.profileMode === 'persistent',
    internetAccess: app.network.policy.allowCidrs.length > 0
  },
  runtime: {
    version: app.runtime.image,
    arguments: app.runtime.containerArgs ?? undefined
  }
})
