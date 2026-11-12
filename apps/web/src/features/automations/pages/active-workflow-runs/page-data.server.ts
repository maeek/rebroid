import { notFound } from 'next/navigation'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import {
  canInspectActiveWorkflowRuns,
  listActiveWorkflowRuns
} from '@/server/orchestrator/automations/active-workflow-runs-query'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const loadActiveWorkflowRuns = async () => {
  const user = await getCurrentUserContext()
  if (!canInspectActiveWorkflowRuns(user.permissions)) notFound()

  const runs = await listActiveWorkflowRuns(user.ownerUserId)
  if (runs.length === 0) return { runs, targets: {} }

  const applications = await orchestratorAppCatalogClient.listApplicationSummaries(user.ownerUserId)
  const targetIds = new Set(runs.map(run => run.targetApplicationId))
  const targets = Object.fromEntries(applications.filter(app => targetIds.has(app.id)).map(app => [app.id, app.name]))
  return { runs, targets }
}
