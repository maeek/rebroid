'use server'

import { runSafeAction } from '@/server/actions/safe-action'
import { getCurrentUserContext } from '../current-user'
import { requireAdminUser, requireUser } from '../shared'
import { orchestratorDiagnosticsClient } from './client'
import { buildResourceLimitBounds } from './resource-limits'

export const getOrchestratorHealthAction = async () => {
  await requireUser()
  return orchestratorDiagnosticsClient.health()
}

export const getOrchestratorHealthSummaryAction = async () => {
  await requireUser()
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

export const getSystemResourcesAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.getSystemResources()
}

export const getResourceLimitBoundsAction = async () => {
  const user = await getCurrentUserContext()
  const resources = await orchestratorDiagnosticsClient.getSystemResourceCapacity()

  return buildResourceLimitBounds(resources, user.quotas)
}
