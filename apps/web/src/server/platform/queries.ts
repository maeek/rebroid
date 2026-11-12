import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'
import { buildResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'

export const getSystemResources = async () => {
  await requireAdmin()
  return orchestratorDiagnosticsClient.getSystemResources()
}

export const getResourceLimitBounds = async () => {
  const user = await getCurrentUserContext()
  const resources = await orchestratorDiagnosticsClient.getSystemResourceCapacity().catch(() => null)
  return buildResourceLimitBounds(resources, user.quotas)
}
