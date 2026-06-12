import { AutomationTriggersPage } from '../../automations-page/triggers/automation-triggers-page'
import { loadAutomationTriggersPageData, type AutomationTriggersSearchParams } from './page-data.server'

export async function AutomationTriggersPageEntry({
  searchParams
}: {
  searchParams?: Promise<AutomationTriggersSearchParams>
}) {
  const { applications, automations, gridQuery, triggersPage } = await loadAutomationTriggersPageData(
    (await searchParams) ?? {}
  )

  return (
    <AutomationTriggersPage
      initialApplications={applications}
      initialAutomations={automations}
      triggersPage={triggersPage}
      gridQuery={gridQuery}
    />
  )
}
