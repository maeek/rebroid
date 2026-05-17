'use server'

import { requireAdminUser, requireUser } from '../shared'
import { orchestratorDiagnosticsClient } from './client'

export const getOrchestratorHealthAction = async () => {
  await requireUser()
  return orchestratorDiagnosticsClient.health()
}

export const repairScrcpySidecarAction = async () => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.repairScrcpySidecar()
}

export const getSystemResourcesAction = async (refreshVolumes = false) => {
  await requireAdminUser()
  return orchestratorDiagnosticsClient.getSystemResources(refreshVolumes)
}
