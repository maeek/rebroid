import { AutomationTracesPage } from '../../automations-page/traces/automation-traces-page'
import { loadAutomationTracesPageData } from './page-data.server'

export async function AutomationTracesPageEntry({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ run?: string }>
}) {
  const { id } = await params
  const { applications, automation, runs } = await loadAutomationTracesPageData(id, (await searchParams)?.run)

  return (
    <AutomationTracesPage
      applications={applications}
      automation={automation}
      runs={runs}
    />
  )
}
