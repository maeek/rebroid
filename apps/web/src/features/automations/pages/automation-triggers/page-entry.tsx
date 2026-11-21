import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { AutomationTriggersPage } from '../../automations-page/triggers/automation-triggers-page'
import { loadAutomationTriggersPageData } from './page-data.server'
import type { WorkflowGridSearchParams } from '../workflow-grid-query'

export async function AutomationTriggersPageEntry({
  searchParams
}: {
  searchParams?: Promise<WorkflowGridSearchParams>
}) {
  const { applications, automations, gridQuery, orchestratorError, triggersPage, ownedAppIds, canRun, canCreateApp } =
    await loadAutomationTriggersPageData((await searchParams) ?? {})

  if (orchestratorError) {
    return <AutomationPageUnavailable title='Triggers' />
  }

  return (
    <AutomationTriggersPage
      initialApplications={applications}
      initialAutomations={automations}
      ownedAppIds={ownedAppIds}
      canRun={canRun}
      canCreateApp={canCreateApp}
      triggersPage={triggersPage}
      gridQuery={gridQuery}
    />
  )
}
