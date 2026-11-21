import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationOptionsAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationTriggersGridAction } from '@/server/orchestrator/automations/automation-trigger-actions'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { validatedSearchParam } from '@/shared/model/search-params'
import { hasPermission } from '@/shared/permissions/permissions'
import {
  emptyWorkflowGridPage,
  workflowGridQueryFromSearchParams,
  type WorkflowGridSearchParams
} from '../workflow-grid-query'
import type { AutomationTriggersGridQuery } from '@/shared/contracts/automation'

const enabledValues = new Set<NonNullable<AutomationTriggersGridQuery['enabled']>>(['true', 'false'])

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const loadAutomationTriggersPageData = async (searchParams: WorkflowGridSearchParams) => {
  const gridQuery = {
    ...workflowGridQueryFromSearchParams(searchParams),
    enabled: validatedSearchParam(searchParams.enabled, enabledValues)
  }
  let orchestratorError: string | null = null
  const captureError = (error: unknown) => {
    orchestratorError ??= errorMessage(error)
  }

  const [applications, automations, triggersPage, user] = await Promise.all([
    listApplicationsAction().catch(error => {
      captureError(error)
      return []
    }),
    listAutomationOptionsAction().catch(error => {
      captureError(error)
      return []
    }),
    listAutomationTriggersGridAction(gridQuery).catch(error => {
      captureError(error)
      return emptyWorkflowGridPage(gridQuery)
    }),
    getCurrentUserContext()
  ])

  return {
    applications,
    ownedAppIds: applications.filter(app => app.ownerUserId === user.ownerUserId).map(app => app.id),
    canRun: hasPermission(user.permissions, 'automations:run'),
    canCreateApp: hasPermission(user.permissions, 'applications:create'),
    automations,
    gridQuery,
    orchestratorError,
    triggersPage
  }
}
