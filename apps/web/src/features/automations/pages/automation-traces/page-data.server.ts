import { notFound } from 'next/navigation'
import { listApplicationNames } from '@/server/orchestrator/applications/application-gallery-query'
import { isWorkflowRun, workflowCatalogIsDisabled } from '@/server/orchestrator/automations/active-workflow-runs-query'
import { orchestratorAutomationsClient } from '@/server/orchestrator/automations/client'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import { hasPermission } from '@/shared/permissions/permissions'

export const loadAutomationTracesPageData = async (id: string, selectedRunId?: string) => {
  const user = await getCurrentUserContext()
  if (!hasPermission(user.permissions, 'automations:manage')) notFound()
  let catalogDisabled = false
  const automation = await orchestratorAutomationsClient.get(user.ownerUserId, id).catch(error => {
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

  const loadSelectedRun = async () => {
    if (selectedRunId === undefined) return undefined
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(selectedRunId)) {
      if (!automation) notFound()
      return undefined
    }
    const selected = await orchestratorAutomationsClient.getRun(user.ownerUserId, selectedRunId).catch(error => {
      if (error instanceof OrchestratorRequestError && error.status === 404) return null
      throw error
    })
    if (selected?.automationId === id && isWorkflowRun(selected)) return selected
    if (!automation) notFound()
    return undefined
  }
  const [applications, runs, selectedRun] = await Promise.all([
    listApplicationNames(user),
    selectedRunId === undefined ? orchestratorAutomationsClient.listRunHistory(user.ownerUserId, id, 50) : [],
    loadSelectedRun()
  ])

  return {
    applications,
    automation: automation && { id: automation.id, name: automation.name },
    runs,
    selectedRun
  }
}
