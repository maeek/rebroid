import 'server-only'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission, type PermissionMap } from '@/shared/permissions/permissions'
import { orchestratorAutomationsClient } from './client'
import type { ActiveWorkflowRun } from '@/shared/contracts/active-workflow-run'
import type { AutomationRun } from '@/shared/contracts/automation'

export const canInspectActiveWorkflowRuns = (permissions: PermissionMap) =>
  hasPermission(permissions, 'automations:run') && hasPermission(permissions, 'automations:manage')

export const isWorkflowRun = (run: Pick<AutomationRun, 'automationId'>) => !run.automationId.startsWith('ephemeral-ai-')

export const listActiveWorkflowRuns = async (ownerUserId: string): Promise<ActiveWorkflowRun[]> =>
  (await orchestratorAutomationsClient.listActiveRuns(ownerUserId)).filter(isWorkflowRun)

export const workflowCatalogIsDisabled = (error: unknown) =>
  error instanceof OrchestratorRequestError &&
  (error.details?.code === 'feature_disabled' || error.details?.code === 'feature_unsupported')
