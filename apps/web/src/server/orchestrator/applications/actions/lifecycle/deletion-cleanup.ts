import { setTimeout as delay } from 'node:timers/promises'
import { after } from 'next/server'
import 'server-only'
import { removeStoredAppIcon } from '@/server/app-icons/store'
import { logger } from '@/server/observability/logger'
import { forgetStoredRecentApp } from '@/server/recent-apps/store'
import { OrchestratorRequestError } from '../../../request'
import { orchestratorAppCatalogClient } from '../../catalog-client'
import type { DeleteAndroidApplicationResponse } from '@/shared/contracts/application'

const waitForDeletion = async (id: string) => {
  const signal = AbortSignal.timeout(60_000)
  for (let waitMs = 1_000; !signal.aborted; waitMs = Math.min(waitMs * 2, 8_000)) {
    try {
      await delay(waitMs, undefined, { signal })
      await orchestratorAppCatalogClient.getApplication(id, signal)
    } catch (error) {
      if (error instanceof OrchestratorRequestError) {
        if (error.status === 404) return true
        if (error.status >= 500) continue
      }
      if (signal.aborted) return false
      throw error
    }
  }
  return false
}

export const scheduleApplicationDeletionCleanup = (
  { id, deleted, cleanupQueued }: DeleteAndroidApplicationResponse,
  ownerUserId: string,
  requestId: string
) => {
  const logFailure = () => logger.warn('application.delete_cleanup_failed', { requestId, applicationId: id })
  try {
    after(async () => {
      try {
        if (!deleted && (!cleanupQueued || !(await waitForDeletion(id)))) return
        const cleanup = await Promise.allSettled([
          removeStoredAppIcon(id),
          Promise.resolve().then(() => forgetStoredRecentApp(ownerUserId, id))
        ])
        if (cleanup.some(result => result.status === 'rejected')) logFailure()
      } catch {
        logFailure()
      }
    })
  } catch {
    logFailure()
  }
}
