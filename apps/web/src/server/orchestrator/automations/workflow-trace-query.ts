import 'server-only'
import { PublicActionError } from '@/server/errors/public-action-error'
import { hasPermission } from '@/shared/permissions/permissions'
import { getCurrentUserContext } from '../current-user'
import { loadFeatureFlags } from '../features'
import { isWorkflowRun } from './active-workflow-runs-query'
import { orchestratorAutomationsClient } from './client'

const unavailable = () => new PublicActionError('Workflow run unavailable.', { code: 'not_found', status: 404 })

export const readExternalWorkflowRun = async (
  workflowId: string,
  runId: string,
  attachmentId: string,
  signal: AbortSignal
) => {
  const user = await getCurrentUserContext('api')
  if (!hasPermission(user.permissions, 'automations:run') || !hasPermission(user.permissions, 'devices:use-external'))
    throw unavailable()
  const run = await orchestratorAutomationsClient.getRun(user.ownerUserId, runId, signal)
  if (
    run.automationId !== workflowId ||
    !isWorkflowRun(run) ||
    run.targetKind !== 'external' ||
    run.targetAttachmentId !== attachmentId
  )
    throw unavailable()
  return run
}

export const readWorkflowTraceRun = async (workflowId: string, runId: string, signal: AbortSignal) => {
  const user = await getCurrentUserContext('api')
  if (!hasPermission(user.permissions, 'automations:manage')) throw unavailable()
  if (!hasPermission(user.permissions, 'automations:run')) {
    const manifest = await loadFeatureFlags()
    if (!manifest?.features.some(flag => flag.key === 'feature.workflows' && flag.effective)) throw unavailable()
  }
  const run = await orchestratorAutomationsClient.getRun(user.ownerUserId, runId, signal)
  if (run.automationId !== workflowId || !isWorkflowRun(run)) throw unavailable()
  return run
}
