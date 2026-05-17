import type { AppDefinition } from '@/features/applications/domain/app-definition'

export const isAppBusy = (app: AppDefinition) => app.status === 'provisioning' || app.status === 'removing'

export const getAppStatusLabel = (app: AppDefinition) => {
  if (app.status === 'error') return 'Error'
  if (app.status === 'provisioning') return app.lifecycleStage.replaceAll('_', ' ')
  return app.status
}
