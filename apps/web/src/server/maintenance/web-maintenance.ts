import 'server-only'
import { logger } from '@/server/observability/logger'
import { cleanDeletedApplicationMetadata } from '@/server/orchestrator/applications/actions/lifecycle/deletion-cleanup'
import {
  deleteWebMaintenance,
  getWebMaintenance,
  listDueWebMaintenance,
  retryWebMaintenance,
  type WebMaintenanceJob
} from '@/server/persistence/web-maintenance-repository'
import { revokeViewerSessionsForUsers } from '@/server/users/revoke-viewer-sessions'

interface MaintenanceState {
  active: Map<string, Promise<boolean>>
  polling: boolean
  timer?: NodeJS.Timeout
}

const runtime = globalThis as typeof globalThis & { rebroidWebMaintenance?: MaintenanceState }
const maxActiveJobs = 4
const state: MaintenanceState = (runtime.rebroidWebMaintenance ??= { active: new Map(), polling: false })

const finishJob = async (job: WebMaintenanceJob) => {
  const signal = AbortSignal.timeout(20_000)
  if (job.kind === 'app-deletion') return cleanDeletedApplicationMetadata(job, signal)
  await revokeViewerSessionsForUsers(job.userIds, signal)
  return true
}

const attemptJob = async (id: string) => {
  const job = getWebMaintenance(id)
  if (!job) return true

  try {
    if (await finishJob(job)) {
      deleteWebMaintenance(job.id)
      return true
    }
  } catch (error) {
    logger.warn('web_maintenance.retry', {
      requestId: job.requestId,
      jobId: job.id,
      kind: job.kind,
      attempts: job.attempts + 1,
      errorName: error instanceof Error ? error.name : 'UnknownError'
    })
  }
  const delayMs = Math.min(5_000 * 2 ** Math.min(job.attempts, 6), 5 * 60_000)
  retryWebMaintenance(job.id, Date.now() + delayMs)
  return false
}

export const runWebMaintenance = (id: string): Promise<boolean> => {
  const existing = state.active.get(id)
  if (existing) return existing
  if (state.active.size >= maxActiveJobs) return Promise.resolve(false)

  const pending = attemptJob(id)
    .catch(error => {
      logger.error('web_maintenance.state_failed', {
        jobId: id,
        errorName: error instanceof Error ? error.name : 'UnknownError'
      })
      return false
    })
    .finally(() => state.active.delete(id))
  state.active.set(id, pending)
  return pending
}

export const runDueWebMaintenance = async (now = Date.now()) => {
  if (state.polling) return
  state.polling = true
  try {
    const jobs = listDueWebMaintenance(now, maxActiveJobs)
    await Promise.all(jobs.map(job => runWebMaintenance(job.id)))
  } finally {
    state.polling = false
  }
}

export const startWebMaintenance = () => {
  if (state.timer) return
  state.timer = setInterval(() => {
    void runDueWebMaintenance().catch(error => {
      logger.error('web_maintenance.poll_failed', { errorName: error instanceof Error ? error.name : 'UnknownError' })
    })
  }, 5_000)
  state.timer.unref()
}
