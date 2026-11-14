import { notFound } from 'next/navigation'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { isWorkflowRun, workflowCatalogIsDisabled } from '@/server/orchestrator/automations/active-workflow-runs-query'
import { getAutomationAction } from '@/server/orchestrator/automations/automation-management-actions'
import { listAutomationRunsAction } from '@/server/orchestrator/automations/automation-run-actions'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission } from '@/shared/permissions/permissions'

export const loadAutomationTracesPageData = async (id: string, selectedRunId?: string) => {
  const user = await getCurrentUserContext()
  if (!hasPermission(user.permissions, 'automations:manage')) notFound()
  let catalogDisabled = false
  const automation = await getAutomationAction(id).catch(error => {
    if (error instanceof OrchestratorRequestError && error.status === 404) return null
    if (workflowCatalogIsDisabled(error)) {
      catalogDisabled = true
      return null
    }
    throw error
  })
  if (
    !automation &&
    (!catalogDisabled || selectedRunId === undefined || !hasPermission(user.permissions, 'automations:run'))
  )
    notFound()

  const loadRuns = async () => {
    if (selectedRunId === undefined) return listAutomationRunsAction(id, 50)
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(selectedRunId)) {
      if (!automation) notFound()
      return []
    }
    const selected = await orchestratorAutomationsClient.getRun(user.ownerUserId, selectedRunId).catch(error => {
      if (error instanceof OrchestratorRequestError && error.status === 404) return null
      throw error
    })
    if (selected?.automationId === id && isWorkflowRun(selected)) return [selected]
    if (!automation) notFound()
    return []
  }
  const [applications, runs] = await Promise.all([listApplicationsAction(), loadRuns()])

  return {
    applications,
    automation,
    runs
  }
}
