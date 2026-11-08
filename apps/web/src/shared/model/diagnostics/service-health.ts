import type { OrchestratorHealth, ServiceHealth } from '@/shared/contracts/diagnostics'

export type DisplayServiceHealth = Omit<ServiceHealth, 'status'> & {
  status: ServiceHealth['status'] | 'degraded'
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
