import { notFound } from 'next/navigation'
import { AutomationTracesPage } from '@/features/automations/automations-page/traces/automation-traces-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getAutomationAction, listAutomationRunsAction } from '@/server/orchestrator/automations/actions'

export default async function AutomationTracesRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const automation = await getAutomationAction(id).catch(() => null)
  if (!automation) {
    notFound()
  }

  const [applications, runs] = await Promise.all([
    listApplicationsAction({ reconcile: false }),
    listAutomationRunsAction(id, 50)
  ])

  return (
    <AutomationTracesPage
      applications={applications}
      automation={automation}
      runs={runs}
    />
  )
}
