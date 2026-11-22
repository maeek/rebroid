import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { AutomationTriggersPage } from '../../automations-page/triggers/automation-triggers-page'
import { loadAutomationTriggersPageData } from './page-data.server'
import type { WorkflowGridSearchParams } from '../workflow-grid-query'

export async function AutomationTriggersPageEntry({
  searchParams
}: {
  searchParams?: Promise<WorkflowGridSearchParams>
}) {
  const result = await loadAutomationTriggersPageData((await searchParams) ?? {})
  if (!result.ok)
    return (
      <AutomationPageUnavailable
        title='Triggers'
        requestId={result.requestId}
      />
    )
  const { applications, automations, gridQuery, triggersPage, targetApps, canRun, canCreateApp } = result.data

  return (
    <AutomationTriggersPage
      initialApplications={applications}
      initialAutomations={automations}
      targetApps={targetApps}
      canRun={canRun}
      canCreateApp={canCreateApp}
      triggersPage={triggersPage}
      gridQuery={gridQuery}
    />
  )
}
