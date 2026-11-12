'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { requireAdminUser } from '../shared'
import { orchestratorDiagnosticsClient } from './client'

export const getOrchestratorHealthSummaryAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.healthSummary()
}

export const getDisplaySidecarHealthAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.displaySidecarHealth()
}

export const repairDisplaySidecarAction = async () =>
  runSafeAction(
    async () => {
      await requireAdminUser()
      return orchestratorDiagnosticsClient.repairDisplaySidecar()
    },
    { fallbackMessage: 'Could not restart the display sidecar.', logLabel: 'Display sidecar restart' }
  )

export const listDisplaySidecarSessionsAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.listDisplaySidecarSessions()
}

export const releaseDisplaySidecarSessionAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.releaseDisplaySidecarSession(id)
}
