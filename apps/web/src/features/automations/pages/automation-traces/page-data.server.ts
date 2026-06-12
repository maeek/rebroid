import { notFound } from 'next/navigation'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'

export const loadAutomationTracesPageData = async (id: string) => {
  const automation = await getAutomationAction(id).catch(() => null)
  if (!automation) {
    notFound()
  }

  const [applications, runs] = await Promise.all([
    listApplicationsAction({ reconcile: false }),
    listAutomationRunsAction(id, 50)
  ])

  return {
    applications,
    automation,
    runs
  }
}
