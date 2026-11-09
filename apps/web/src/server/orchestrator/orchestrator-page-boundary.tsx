import { cache, type ReactNode } from 'react'
import { unstable_rethrow } from 'next/navigation'
import 'server-only'
import { getOrchestratorHealthSummaryAction } from './diagnostics/actions'
import { OrchestratorRequestError } from './request'
import type { OrchestratorHealth } from '@/shared/contracts/diagnostics'

const pageHealth = cache(getOrchestratorHealthSummaryAction)

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
  let data: T
  try {
    const health = await pageHealth()
    if (!health.services.orchestrator.ok) return unavailable()
    data = await load(health)
  } catch (error) {
    unstable_rethrow(error)
    if (error instanceof OrchestratorRequestError && error.status >= 500) return unavailable(error.requestId)
    throw error
  }
  return children(data)
}
