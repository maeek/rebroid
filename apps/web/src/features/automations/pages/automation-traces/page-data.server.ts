import { notFound } from 'next/navigation'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { getAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'

export const loadAutomationTracesPageData = async (id: string, selectedRunId?: string) => {
  const automation = await getAutomationAction(id).catch(error => {
    if (error instanceof OrchestratorRequestError && error.status === 404) return null
    throw error
  })
  if (!automation) {
    notFound()
  }

  const loadRuns = async () => {
    if (selectedRunId === undefined) return listAutomationRunsAction(id, 50)
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(selectedRunId)) return []
    const user = await getCurrentUserContext()
    const selected = await orchestratorAutomationsClient.getRun(user.ownerUserId, selectedRunId).catch(error => {
      if (error instanceof OrchestratorRequestError && error.status === 404) return null
      throw error
    })
    return selected?.automationId === automation.id ? [selected] : []
  }
  const [applications, runs] = await Promise.all([listApplicationsAction(), loadRuns()])

  return {
    applications,
    automation,
    runs
  }
}
