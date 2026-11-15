import 'server-only'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { orchestratorAutomationsClient } from './client'
import type { ActiveWorkflowRun } from '@/shared/contracts/active-workflow-run'
import type { AutomationRun } from '@/shared/contracts/automation'

export const canInspectActiveWorkflowRuns = (permissions: PermissionMap) =>
  hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:manage')

export const isWorkflowRun = (run: Pick<AutomationRun, 'automationId'>) => !run.automationId.startsWith('ephemeral-ai-')

export const listActiveWorkflowRuns = async (ownerUserId: string): Promise<ActiveWorkflowRun[]> => {
  const runs = (await orchestratorAutomationsClient.listActiveRuns(ownerUserId)).flatMap<ActiveWorkflowRun>(
    ({ id, automationId, targetApplicationId, createdAt, status }) => {
      if (!isWorkflowRun({ automationId }) || (status !== 'queued' && status !== 'running')) return []
      return [{ id, automationId, targetApplicationId, createdAt, status, workflowName: null }]
    }
  )
  if (runs.length === 0) return []

  const workflows = await orchestratorAutomationsClient.listRunnableOptions(ownerUserId).catch(error => {
    if (workflowCatalogIsDisabled(error)) return []
    throw error
  })
  const workflowNames = new Map(workflows.map(workflow => [workflow.id, workflow.name]))
  return runs.map(run => ({ ...run, workflowName: workflowNames.get(run.automationId) ?? null }))
}

export const workflowCatalogIsDisabled = (error: unknown) =>
  error instanceof OrchestratorRequestError &&
  (error.details?.code === 'feature_disabled' || error.details?.code === 'feature_unsupported')
