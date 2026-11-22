import { runSafeAction } from '@/server/actions/safe-action'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { requireAutomationUser } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { loadWorkflowHistoryRetention } from '@/server/orchestrator/scheduled-tasks/workflow-history-retention'
import { workflowGridQueryFromSearchParams, type WorkflowGridSearchParams } from '../workflow-grid-query'

export const loadAutomationsListPageData = (searchParams: WorkflowGridSearchParams) =>
  runSafeAction(
    async () => {
      const user = await requireAutomationUser('automations:manage')
      const gridQuery = workflowGridQueryFromSearchParams(searchParams)
      const [automationsPage, applications, workflowHistoryRetention] = await Promise.all([
        orchestratorAutomationsClient.listGrid(user.ownerUserId, gridQuery),
        listApplicationsAction(),
        loadWorkflowHistoryRetention()
      ])
      return { applications, automationsPage, gridQuery, workflowHistoryRetention }
    },
    { logLabel: 'Load workflows' }
  )
