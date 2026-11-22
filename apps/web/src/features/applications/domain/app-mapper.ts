import { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  AndroidApplication,
  AndroidApplicationDetailState,
  ApplicationDetailRefresh,
  ApplicationPowerAcknowledgement
} from '@/shared/contracts/application'

const mapApplicationDetailState = ({ status, errors, updatedAt }: AndroidApplicationDetailState) => ({
  running: status.currentStatus === 'running',
  status: status.currentStatus,
  lifecycleStage: status.lifecycleStage,
  statusMessage: status.message,
  statusDetail: status.detail,
  recreateContainerOnNextStart: status.recreateRequired,
  lastError: errors.lastError,
  lastStartedAt: status.lastStartedAt ? new Date(status.lastStartedAt) : undefined,
  lastStoppedAt: status.lastStoppedAt ? new Date(status.lastStoppedAt) : undefined,
  provisioningStartedAt: status.provisioningStartedAt ? new Date(status.provisioningStartedAt) : undefined,
  provisioningCompletedAt: status.provisioningCompletedAt ? new Date(status.provisioningCompletedAt) : undefined,
  updatedAt: new Date(updatedAt),
  imagePullProgress: status.progress,
  applicationError: errors.application
})

export const mergeApplicationDetailRefresh = (
  current: AppDefinition,
  { app, state }: ApplicationDetailRefresh,
  requestedRevision?: string
): AppDefinition => {
  if (app) {
    if (app.id !== current.id) return current
    const detailsRevoked = current.detailRevision?.endsWith('.1') && app.detailRevision?.endsWith('.0')
    if (
      !detailsRevoked &&
      (current.detailRevision !== requestedRevision || current.updatedAt > new Date(app.updatedAt))
    ) {
      return current
    }
    return {
      ...mapAndroidApplicationToAppDefinition(app),
      icon: current.icon,
      ownerDisplayName: current.ownerDisplayName ?? app.ownerDisplayName
    }
  }
  if (!state || current.detailRevision !== requestedRevision || current.updatedAt > new Date(state.updatedAt)) {
    return current
  }
  return { ...current, ...mapApplicationDetailState(state) }
}

export const applyApplicationPowerAcknowledgement = (
  app: AppDefinition,
  command: ApplicationPowerAcknowledgement
): AppDefinition => ({
  ...app,
  running: command.status === 'running',
  status: command.status,
  lifecycleStage: command.lifecycleStage,
  statusMessage: command.message,
  statusDetail: app.lifecycleStage === command.lifecycleStage ? app.statusDetail : null,
  ...(command.profile && {
    profileMode: command.profile.mode,
    profileName: command.profile.name,
    container: { ...app.container, persistentStorage: command.profile.mode === 'persistent' }
  })
})

export const mapAndroidApplicationToAppDefinition = (app: AndroidApplication): AppDefinition => ({
  id: app.id,
  name: app.name,
  icon: null,
  ...mapApplicationDetailState(app),
  ownerUserId: app.ownerUserId,
  ownerDisplayName: app.ownerDisplayName,
  containerImage: app.runtime.image,
  runtimeKind: app.runtime.kind ?? 'generic',
  containerName: app.runtime.containerName,
  containerId: app.runtime.containerId,
  networkName: app.network.networkName,
  volumeName: app.storage.volumeName,
  profileMode: app.storage.profileMode,
  profileName: app.storage.profileName,
  savedProfiles: app.storage.savedProfiles ?? [],
  memoryLimitMb: app.runtime.resources.memoryLimitMb,
  cpuLimitCpus: app.runtime.resources.cpuLimitCpus,
  containerArgs: app.runtime.containerArgs,
  networkPolicyEnabled: app.network.policy.enabled,
  networkPolicyAllowCidrs: app.network.policy.allowCidrs,
  networkPolicyResult: app.network.policy.result,
  networkPolicyAppliedAt: app.network.policy.appliedAt ? new Date(app.network.policy.appliedAt) : null,
  apkOriginalName: app.apk.originalName,
  apkPackageName: app.apk.packageName,
  apkFilePath: app.apk.filePath,
  uploadedApkId: app.apk.uploadedApkId,
  scrcpyTransport: app.runtime.scrcpyTransport,
  adbPort: app.runtime.adbPort,
  inactivityTimeoutSeconds: app.runtime.inactivityTimeoutSeconds,
  createdAt: new Date(app.createdAt),
  detailRevision: app.detailRevision,
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
