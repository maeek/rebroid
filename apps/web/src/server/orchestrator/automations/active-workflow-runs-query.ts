import 'server-only'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { orchestratorAutomationsClient } from './client'
import type { ActiveWorkflowRun } from '@/shared/contracts/active-workflow-run'

export const canInspectActiveWorkflowRuns = (permissions: PermissionMap) =>
  hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:manage')

export const listActiveWorkflowRuns = async (ownerUserId: string): Promise<ActiveWorkflowRun[]> => {
  const runs = await orchestratorAutomationsClient.listActiveRuns(ownerUserId)
  if (runs.length === 0) return []

  const workflows = await orchestratorAutomationsClient.list(ownerUserId).catch(error => {
    if (
      error instanceof OrchestratorRequestError &&
      (error.details?.code === 'feature_disabled' || error.details?.code === 'feature_unsupported')
    ) {
      return []
    }
    throw error
  })
  const workflowNames = new Map(workflows.map(workflow => [workflow.id, workflow.name]))
  return runs.flatMap(({ id, automationId, targetApplicationId, createdAt, status }) => {
    const workflowName = workflowNames.get(automationId)
    if (workflowName === undefined || (status !== 'queued' && status !== 'running')) return []
    return [{ id, automationId, workflowName, targetApplicationId, createdAt, status }]
  })
}
