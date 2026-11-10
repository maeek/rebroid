import type { ReactNode } from 'react'
import 'server-only'
import { getOrchestratorPageHealth, readOrchestratorPage } from './orchestrator-page-read'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

/** Stop dependent reads before mounting a runtime-backed page during a known outage. */
export const OrchestratorPageBoundary = async <T,>({
  load,
  children,
  fallback
}: {
  load: (health: OrchestratorHealth) => Promise<T>
  children: (data: T) => ReactNode
  fallback: ReactNode | ((requestId?: string) => ReactNode)
}) => {
  const unavailable = (requestId?: string) => (typeof fallback === 'function' ? fallback(requestId) : fallback)
  const health = await readOrchestratorPage(getOrchestratorPageHealth)
  if (!health.ok) return unavailable(health.failure.requestId)
  if (!health.data.services.orchestrator.ok) return unavailable()
  const result = await readOrchestratorPage(() => load(health.data))
  return result.ok ? children(result.data) : unavailable(result.failure.requestId)
}
