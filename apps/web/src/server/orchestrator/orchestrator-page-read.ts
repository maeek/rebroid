import { cache } from 'react'
import { unstable_rethrow } from 'next/navigation'
import 'server-only'
import { normalizeRequestId } from '@/server/observability/request-id'
import { orchestratorDiagnosticsClient } from './diagnostics/client'
import { OrchestratorRequestError } from './request'
import { requireUser } from './shared'

export const getOrchestratorPageHealth = cache(async () => {
  await requireUser()
  return orchestratorDiagnosticsClient.healthSummary()
})

export type OrchestratorPageFailure = {
  kind: 'unavailable' | 'missing'
  requestId?: string
}

type OrchestratorPageRead<T> = { ok: true; data: T } | { ok: false; failure: OrchestratorPageFailure }

export const readOrchestratorPage = async <T>(
  load: () => Promise<T>,
  { allowMissing = false } = {}
): Promise<OrchestratorPageRead<T>> => {
  try {
    return { ok: true, data: await load() }
  } catch (error) {
    unstable_rethrow(error)
    if (!(error instanceof OrchestratorRequestError)) throw error

    const requestId = error.requestId === 'unknown' ? undefined : (normalizeRequestId(error.requestId) ?? undefined)
    if (allowMissing && error.status === 404) return { ok: false, failure: { kind: 'missing', requestId } }
    if (error.status >= 500) return { ok: false, failure: { kind: 'unavailable', requestId } }
    throw error
  }
}
