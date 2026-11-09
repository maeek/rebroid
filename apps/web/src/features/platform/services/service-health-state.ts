import type { ServiceRow } from './service-row'
import type { DisplayServiceHealth } from '@/shared/model/diagnostics/service-health'

export const serviceHealthState = (health?: DisplayServiceHealth): ServiceRow['state'] => {
  if (!health) return { label: 'Unknown', tone: 'warning', description: 'Service health could not be checked.' }
  const states = {
    healthy: { label: 'Healthy', tone: 'success' },
    unhealthy: { label: 'Unhealthy', tone: 'warning' },
    degraded: { label: 'Degraded', tone: 'warning' },
    offline: { label: 'Offline', tone: 'danger' },
    disabled: { label: 'Disabled', tone: 'neutral' }
  } as const
  return { ...states[health.status], description: health.message }
}
