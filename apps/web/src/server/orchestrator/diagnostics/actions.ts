'use server'

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

export const getDockerMetricsAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.dockerMetrics()
}

export const repairDisplaySidecarAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.repairDisplaySidecar()
}

export const listDisplaySidecarSessionsAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.listDisplaySidecarSessions()
}

export const releaseDisplaySidecarSessionAction = async (id: string) => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.releaseDisplaySidecarSession(id)
}

export const getSystemResourcesAction = async (refreshVolumes = false) => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.getSystemResources(refreshVolumes)
}

export const getResourceLimitBoundsAction = async () => {
  const user = await getCurrentUserContext()
  const resources = await orchestratorDiagnosticsClient.getSystemResourceCapacity()

  return buildResourceLimitBounds(resources, user.quotas)
}
