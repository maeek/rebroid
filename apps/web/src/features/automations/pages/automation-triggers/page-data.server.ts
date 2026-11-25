import { runSafeAction } from '@/server/actions/safe-action'
import { listVisibleApplications } from '@/server/orchestrator/applications/application-list-query'
import { requireAutomationUser } from '@/server/orchestrator/automations/action-helpers'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { listExternalWorkflowDevices } from '@/server/orchestrator/automations/workflow-device-options'
import { validatedSearchParam } from '@/shared/model/search-params'
import { hasPermission } from '@/shared/permissions/permissions'
import {
  toTriggerApplication,
  toTriggerExternalDevice
} from '../../automations-page/triggers/automation-trigger-resource-options'
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
      const [applications, external, automations, triggersPage] = await Promise.all([
        listVisibleApplications(),
        listExternalWorkflowDevices(user),
        orchestratorAutomationsClient.listOptions(user.ownerUserId),
        orchestratorAutomationsClient.listTriggersGrid(user.ownerUserId, gridQuery)
      ])
      return {
        applications: [
          ...applications.map(({ id, name }) => ({ id, name })),
          ...external.map(({ id, name }) => ({ id, name, external: true }))
        ],
        targetApps: [
          ...applications.filter(app => app.ownerUserId === user.ownerUserId).map(toTriggerApplication),
          ...external.map(toTriggerExternalDevice)
        ],
        canRun: hasPermission(user.permissions, 'automations:run'),
        canCreateApp: hasPermission(user.permissions, 'applications:create'),
        automations,
        gridQuery,
        triggersPage
      }
    },
    { logLabel: 'Load workflow triggers' }
  )
