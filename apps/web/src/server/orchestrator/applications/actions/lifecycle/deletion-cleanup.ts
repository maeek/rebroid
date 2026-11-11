import { randomUUID } from 'node:crypto'
import 'server-only'
import { removeStoredAppIcon } from '@/server/app-icons/store'
import { logger } from '@/server/observability/logger'
import { forgetDeletedApplication } from '@/server/persistence/recent-applications-repository'
import {
  deleteWebMaintenance,
  enqueueWebMaintenance,
  type AppDeletionJob
} from '@/server/persistence/web-maintenance-repository'
import { OrchestratorRequestError } from '../../../request'
import { orchestratorAppCatalogClient } from '../../catalog-client'

const trackApplicationDeletion = (applicationId: string, requestId: string) => {
  const id = randomUUID()
  // A restart after dispatch can leave the outcome unknown. Give the request time to finish before polling.
  return enqueueWebMaintenance({ id, kind: 'app-deletion', applicationId, requestId }, Date.now() + 60_000)
    ? id
    : undefined
}

const discardRejectedApplicationDeletion = (id: string, error: unknown) => {
  if (
    error instanceof OrchestratorRequestError &&
    error.status >= 400 &&
    error.status < 500 &&
    ![404, 408, 409].includes(error.status)
  ) {
    deleteWebMaintenance(id)
  }
}

const deletionCommands = new Map<string, Promise<void>>()

export const requestTrackedApplicationDeletion = async (
  applicationId: string,
  removeData: boolean,
  requestId: string
) => {
  const previous = deletionCommands.get(applicationId) ?? Promise.resolve()
  const command = previous.then(async () => {
    const jobId = trackApplicationDeletion(applicationId, requestId)
    try {
      const acknowledgement = await orchestratorAppCatalogClient.deleteApplication(applicationId, removeData)
      return { acknowledgement, jobId }
    } catch (error) {
      if (jobId) {
        try {
          discardRejectedApplicationDeletion(jobId, error)
        } catch {
          logger.warn('application.delete_cleanup_discard_failed', { requestId, applicationId })
        }
      }
      throw error
    }
  })
  const settled = command.then(
    () => undefined,
    () => undefined
  )
  deletionCommands.set(applicationId, settled)
  try {
    return await command
  } finally {
    if (deletionCommands.get(applicationId) === settled) deletionCommands.delete(applicationId)
  }
}

export const cleanDeletedApplicationMetadata = async (
  { applicationId, requestId, createdAt }: AppDeletionJob & { createdAt: number },
  signal: AbortSignal
) => {
  try {
    const app = await orchestratorAppCatalogClient.getApplication(applicationId, signal)
    if (Date.now() - createdAt < 24 * 60 * 60_000 || app.status.currentStatus === 'removing') return false
    logger.warn('application.delete_cleanup_not_removing', { requestId, applicationId })
    return true
  } catch (error) {
    if (!(error instanceof OrchestratorRequestError) || error.status !== 404) throw error
  }

  await removeStoredAppIcon(applicationId)
  forgetDeletedApplication(applicationId)
  return true
}
