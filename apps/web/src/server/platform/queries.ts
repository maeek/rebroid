import 'server-only'
import { getCurrentUser, requireAdmin } from '@/server/auth/authorization'
import { PublicActionError } from '@/server/errors/public-action-error'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { orchestratorDiagnosticsClient } from '@/server/orchestrator/diagnostics/client'
import { buildResourceLimitBounds } from '@/server/orchestrator/diagnostics/resource-limits'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

export const getSystemResources = async () => {
  await requireAdmin()
  return orchestratorDiagnosticsClient.getSystemResources()
}

export const getResourceLimitBounds = async () => {
  const user = await getCurrentUserContext()
  const resources = await orchestratorDiagnosticsClient.getSystemResourceCapacity().catch(() => null)
  return buildResourceLimitBounds(resources, user.quotas)
}

export const getDisplaySidecarLogs = async (expanded: boolean) => {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    throw new PublicActionError('Display sidecar logs require administrator access.', {
      code: 'forbidden',
      status: 403
    })
  }
  try {
    return await orchestratorDiagnosticsClient.displaySidecarLogs(expanded)
  } catch (error) {
    if (error instanceof OrchestratorRequestError && error.status === 413) {
      throw new PublicActionError('The sidecar returned too much log output for this view.', {
        code: 'upstream_error',
        status: 413
      })
    }
    throw error
  }
}
