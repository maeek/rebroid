import { AutomationTracesPage } from '../../automations-page/traces/automation-traces-page'
import { loadAutomationTracesPageData } from './page-data.server'

export async function AutomationTracesPageEntry({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { applications, automation, runs } = await loadAutomationTracesPageData(id)

  return (
    <AutomationTracesPage
      applications={applications}
      automation={automation}
      runs={runs}
    />
  )
}
