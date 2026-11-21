import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationsGridAction } from '@/server/orchestrator/automations/automation-management-actions'
import { loadWorkflowHistoryRetention } from '@/server/orchestrator/scheduled-tasks/workflow-history-retention'
import {
  emptyWorkflowGridPage,
  workflowGridQueryFromSearchParams,
  type WorkflowGridSearchParams
} from '../workflow-grid-query'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const loadAutomationsListPageData = async (searchParams: WorkflowGridSearchParams) => {
  const gridQuery = workflowGridQueryFromSearchParams(searchParams)
  let orchestratorError: string | null = null
  const captureError = (error: unknown) => {
    orchestratorError ??= errorMessage(error)
  }

  const [automationsPage, applications, workflowHistoryRetention] = await Promise.all([
    listAutomationsGridAction(gridQuery).catch(error => {
      captureError(error)
      return emptyWorkflowGridPage(gridQuery)
    }),
    listApplicationsAction().catch(error => {
      captureError(error)
      return []
    }),
    loadWorkflowHistoryRetention()
  ])

  return {
    applications,
    automationsPage,
    gridQuery,
    orchestratorError,
    workflowHistoryRetention
  }
}
