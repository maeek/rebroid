import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const optimisticStartingApp = (app: AppDefinition): AppDefinition => ({
  ...app,
  running: false,
  status: 'provisioning',
  lifecycleStage: 'container_starting',
  statusMessage: 'Starting app.',
  statusDetail: {
    code: 'container_starting',
    title: 'Starting container',
    description: 'Starting app.',
    tone: 'progress'
  }
})

export const optimisticStoppingApp = (app: AppDefinition): AppDefinition => ({
  ...app,
  running: false,
  status: 'stopped',
  lifecycleStage: 'stopping',
  statusMessage: 'Stopping app.',
  statusDetail: {
    code: 'stopping',
    title: 'Stopping app',
    description: 'Stopping app.',
    tone: 'progress'
  }
})

export const optimisticRemovingApp = (app: AppDefinition): AppDefinition => ({
  ...app,
  status: 'removing',
  lifecycleStage: 'removing',
  statusMessage: 'Removing app.',
  statusDetail: {
    code: 'removing',
    title: 'Removing app',
    description: 'Removing app.',
    tone: 'progress'
  }
})
