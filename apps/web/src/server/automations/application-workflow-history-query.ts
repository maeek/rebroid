import 'server-only'
import { assertAutomationPermission } from '@/server/orchestrator/automations/action-helpers'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { emptyRequest } from '@/server/orchestrator/request'
import type {
  ApplicationWorkflowRun,
  ApplicationWorkflowRunPage
} from '@/shared/contracts/application-workflow-history'

const workflowHistoryQuery = async (targetApplicationId: string) => {
  const user = await getCurrentUserContext()
  assertAutomationPermission(user, 'automations:run')
  return new URLSearchParams({ ownerUserId: user.ownerUserId, targetApplicationId })
}

export const listApplicationWorkflowRuns = async (
  appId: string,
  { page, pageSize, q }: { page: number; pageSize: number; q: string }
) => {
  const query = await workflowHistoryQuery(appId)
  query.set('page', String(page))
  query.set('pageSize', String(pageSize))
  if (q) query.set('q', q)
  return emptyRequest<ApplicationWorkflowRunPage>(`/automations/runs/history?${query}`)
}

export const readApplicationWorkflowRun = async (appId: string, runId: string) => {
  const query = await workflowHistoryQuery(appId)
  return emptyRequest<ApplicationWorkflowRun>(`/automations/runs/history/${encodeURIComponent(runId)}?${query}`)
}
