import type { AppDefinition } from '@/features/applications/domain/app-definition'

export type LogSource = 'orchestrator' | 'container' | 'adb'

export const isSourceUnavailableForApp = (app: AppDefinition | undefined, source: LogSource) => {
  if (!app) {
    return true
  }

  if (source === 'orchestrator') {
    return false
  }

  if (source === 'adb') {
    return !app.running
  }

  return !app.containerId || app.status === 'removed'
}

export const unavailableSourceMessage = (app: AppDefinition | undefined, source: LogSource) => {
  if (!app) {
    return 'Select an application to inspect logs.'
  }

  if (source === 'adb') {
    return 'ADB logs are available after the Android container is running.'
  }

  if (source === 'container') {
    return 'Container logs are unavailable because no runtime container exists yet.'
  }

  return 'Refresh logs to inspect orchestrator lifecycle events.'
}
