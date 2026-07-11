import 'server-only'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'
import { buildResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'

export const getSystemResources = async () => {
  await getCurrentUserContext()
  return orchestratorDiagnosticsClient.getSystemResources()
}

export const getResourceLimitBounds = async () => {
  const user = await getCurrentUserContext()
  const resources = await orchestratorDiagnosticsClient.getSystemResourceCapacity().catch(() => null)
  return buildResourceLimitBounds(resources, user.quotas)
}
