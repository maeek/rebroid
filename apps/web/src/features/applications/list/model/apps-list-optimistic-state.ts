import type { ApplicationPowerAcknowledgement } from '@/shared/contracts/application'
import type { AppGalleryItem } from '@/shared/contracts/application-gallery'

export const applyGalleryPowerAcknowledgement = (
  app: AppGalleryItem,
  command: ApplicationPowerAcknowledgement
): AppGalleryItem => ({
  ...app,
  running: command.status === 'running',
  status: command.status,
  lifecycleStage: command.lifecycleStage
})

export const optimisticStartingApp = (app: AppGalleryItem): AppGalleryItem => ({
  ...app,
  running: false,
  status: 'provisioning',
  lifecycleStage: 'container_starting'
})

export const optimisticStoppingApp = (app: AppGalleryItem): AppGalleryItem => ({
  ...app,
  running: false,
  status: 'stopped',
  lifecycleStage: 'stopping'
})

export const optimisticRemovingApp = (app: AppGalleryItem): AppGalleryItem => ({
  ...app,
  running: false,
  status: 'removing',
  lifecycleStage: 'removing'
})
