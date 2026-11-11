import type { OrchestratorHealth, ServiceHealth } from '@/shared/contracts/diagnostics'
import type { FeatureFlagState } from '@/shared/contracts/feature-flags'

export type DisplayServiceHealth = Omit<ServiceHealth, 'status'> & {
  status: ServiceHealth['status'] | 'degraded'
}

export const isOptionalServiceVisible = (feature?: FeatureFlagState, health?: ServiceHealth) =>
  feature ? feature.enabled && feature.supported : health?.status !== 'disabled'

export const serviceHealthState = (health?: DisplayServiceHealth) => {
  if (!health)
    return { label: 'Unknown', tone: 'warning', description: 'Service health could not be checked.' } as const
  const states = {
    healthy: { label: 'Healthy', tone: 'success' },
    unhealthy: { label: 'Unhealthy', tone: 'warning' },
    degraded: { label: 'Degraded', tone: 'warning' },
    offline: { label: 'Offline', tone: 'danger' },
    disabled: { label: 'Disabled', tone: 'neutral' }
  } as const
  return { ...states[health.status], description: health.message }
}

export const dockerRuntimeHealth = (health: OrchestratorHealth): DisplayServiceHealth => {
  const { docker, runtime } = health.services
  if (!docker.ok) return docker
  if (!runtime.ok) return { ...runtime, status: 'degraded' }
  return {
    ...docker,
    message: 'Docker API is reachable and the container runtime supports privileged app containers.'
  }
}
