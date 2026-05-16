import type { AppDefinition } from '@/app/(protected)/(standard)/constants'

export const isAppBusy = (app: AppDefinition) => app.status === 'provisioning' || app.status === 'removing'

export const getAppStatusLabel = (app: AppDefinition) => {
  if (app.status === 'error') return 'Error'
  if (app.status === 'provisioning') return app.lifecycleStage.replaceAll('_', ' ')
  return app.status
}
