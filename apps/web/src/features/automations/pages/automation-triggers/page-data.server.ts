import { runSafeAction } from '@/server/actions/safe-action'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { requireAutomationUser } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { validatedSearchParam } from '@/shared/model/search-params'
import { hasPermission } from '@/shared/permissions/permissions'
import { workflowGridQueryFromSearchParams, type WorkflowGridSearchParams } from '../workflow-grid-query'
import type { AutomationTriggersGridQuery } from '@/shared/contracts/automation'

const enabledValues = new Set<NonNullable<AutomationTriggersGridQuery['enabled']>>(['true', 'false'])

export const loadAutomationTriggersPageData = (searchParams: WorkflowGridSearchParams) =>
  runSafeAction(
    async () => {
      const user = await requireAutomationUser('automations:manage')
      const gridQuery = {
        ...workflowGridQueryFromSearchParams(searchParams),
        enabled: validatedSearchParam(searchParams.enabled, enabledValues)
      }
      const [applications, automations, triggersPage] = await Promise.all([
        listApplicationsAction(),
        orchestratorAutomationsClient.listOptions(user.ownerUserId),
        orchestratorAutomationsClient.listTriggersGrid(user.ownerUserId, gridQuery)
      ])
      return {
        applications,
        ownedAppIds: applications.filter(app => app.ownerUserId === user.ownerUserId).map(app => app.id),
        canRun: hasPermission(user.permissions, 'automations:run'),
        canCreateApp: hasPermission(user.permissions, 'applications:create'),
        automations,
        gridQuery,
        triggersPage
      }
    },
    { logLabel: 'Load workflow triggers' }
  )
