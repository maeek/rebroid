import { notFound } from 'next/navigation'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const loadAutomationTracesPageData = async (id: string, selectedRunId?: string) => {
  const automation = await getAutomationAction(id).catch(() => null)
  if (!automation) {
    notFound()
  }

  const [applications, runs] = await Promise.all([listApplicationsAction(), listAutomationRunsAction(id, 50)])

  if (selectedRunId && /^[a-zA-Z0-9_-]{1,128}$/.test(selectedRunId) && !runs.some(run => run.id === selectedRunId)) {
    const user = await getCurrentUserContext()
    const selected = await orchestratorAutomationsClient.getRun(user.ownerUserId, selectedRunId).catch(() => null)
    if (selected?.automationId === automation.id) runs.unshift(selected)
  }

  return {
    applications,
    automation,
    runs
  }
}
