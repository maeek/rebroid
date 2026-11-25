'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorDiagnosticsClient } from './client'

export const getOrchestratorHealthSummaryAction = async () => {
  await requireAdmin()
  return orchestratorDiagnosticsClient.healthSummary()
}

export const getDisplaySidecarHealthAction = async () => {
  await requireAdmin()
  return orchestratorDiagnosticsClient.displaySidecarHealth()
}

export const repairDisplaySidecarAction = async () =>
  runSafeAction(
    async () => {
      await requireAdmin()
      return orchestratorDiagnosticsClient.repairDisplaySidecar()
    },
    { fallbackMessage: 'Could not restart the display sidecar.', logLabel: 'Display sidecar restart' }
  )

export const listDisplaySidecarSessionsAction = async (includeManaged = true) => {
  await requireAdmin()
  return includeManaged
    ? orchestratorDiagnosticsClient.listDisplaySidecarSessions()
    : orchestratorDiagnosticsClient.listDisplaySidecarSessions(undefined, false)
}

export const releaseDisplaySidecarSessionAction = async (id: string, external = false) => {
  await requireAdmin()
  return external
    ? orchestratorDiagnosticsClient.releaseDisplaySidecarSession(id, undefined, true)
    : orchestratorDiagnosticsClient.releaseDisplaySidecarSession(id)
}
