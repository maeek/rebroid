import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { AutomationTriggersPage } from '../../automations-page/triggers/automation-triggers-page'
import { loadAutomationTriggersPageData, type AutomationTriggersSearchParams } from './page-data.server'

export async function AutomationTriggersPageEntry({
  searchParams
}: {
  searchParams?: Promise<AutomationTriggersSearchParams>
}) {
  const { applications, automations, gridQuery, orchestratorError, triggersPage } =
    await loadAutomationTriggersPageData((await searchParams) ?? {})

  if (orchestratorError) {
    return (
      <AutomationPageUnavailable
        title='Triggers'
        detail={orchestratorError}
        href='/automations/triggers'
      />
    )
  }

  return (
    <AutomationTriggersPage
      initialApplications={applications}
      initialAutomations={automations}
      triggersPage={triggersPage}
      gridQuery={gridQuery}
    />
  )
}
