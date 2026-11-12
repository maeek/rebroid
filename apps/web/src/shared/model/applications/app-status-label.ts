import type { AndroidApplicationLifecycleStage, AndroidApplicationStatus } from '@/shared/contracts/application'

export const getAppStatusLabel = (status: AndroidApplicationStatus, stage: AndroidApplicationLifecycleStage) => {
  if (status === 'error') return 'Error'
  if (stage === 'stopping') return 'Stopping'
  if (status === 'provisioning') return stage.replaceAll('_', ' ')
  return status
}
