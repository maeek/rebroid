import type { AppDefinition } from '@/features/applications/domain/app-definition'

const PROVISIONING_REFRESH_MS = 3000
const REMOVING_REFRESH_MS = 5000
const DEFAULT_APP_REFRESH_MS = 15000

export const getAppRefreshIntervalMs = (app?: Pick<AppDefinition, 'status'> | null) => {
  if (!app) {
    return null
  }

  if (app.status === 'provisioning') {
    return PROVISIONING_REFRESH_MS
  }

  if (app.status === 'removing') {
    return REMOVING_REFRESH_MS
  }

  return DEFAULT_APP_REFRESH_MS
}

export const getAppsRefreshIntervalMs = (apps: Array<Pick<AppDefinition, 'status'>>, fallbackIntervalMs: number) => {
  if (apps.some(app => app.status === 'provisioning')) {
    return PROVISIONING_REFRESH_MS
  }

  if (apps.some(app => app.status === 'removing')) {
    return REMOVING_REFRESH_MS
  }

  return fallbackIntervalMs
}
