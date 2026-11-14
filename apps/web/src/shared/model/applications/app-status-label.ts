import type { AndroidApplicationLifecycleStage, AndroidApplicationStatus } from '@/shared/contracts/application'

const provisioningLabels: Partial<Record<AndroidApplicationLifecycleStage, string>> = {
  queued: 'Queued',
  image_checking: 'Checking image',
  image_pulling: 'Pulling image',
  volume_creating: 'Creating storage',
  network_creating: 'Creating network',
  orchestrator_network_connecting: 'Connecting network',
  container_creating: 'Creating container',
  container_starting: 'Starting container',
  android_booting: 'Booting Android',
  apk_installing: 'Installing APK'
}

export const getAppStatusLabel = (status: AndroidApplicationStatus, stage: AndroidApplicationLifecycleStage) => {
  if (status === 'error') return 'Error'
  if (stage === 'stopping') return 'Stopping'
  if (status === 'provisioning') return provisioningLabels[stage] ?? 'Provisioning'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export const getAppStatusTone = (status: AndroidApplicationStatus, label?: string | null) => {
  if (status === 'error') return 'danger'
  if (status === 'provisioning' || status === 'removing' || label === 'Stopping') return 'info'
  if (status === 'running') return 'success'
  return 'neutral'
}
