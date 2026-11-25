import { notFound } from 'next/navigation'
import { orchestratorAppCatalogClient } from '@/server/orchestrator/applications/catalog-client'
import {
  canInspectActiveWorkflowRuns,
  listActiveWorkflowRuns
} from '@/server/orchestrator/automations/active-workflow-runs-query'
import { listExternalWorkflowDevices } from '@/server/orchestrator/automations/workflow-device-options'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'

export const loadActiveWorkflowRuns = async () => {
  const user = await getCurrentUserContext()
  if (!canInspectActiveWorkflowRuns(user.permissions)) notFound()

  const runs = await listActiveWorkflowRuns(user.ownerUserId)
  if (runs.length === 0) return { runs, targets: {} }

  const [applications, external] = await Promise.all([
    orchestratorAppCatalogClient.listApplicationSummaries(user.ownerUserId),
    runs.some(run => run.targetKind === 'external') ? listExternalWorkflowDevices(user) : []
  ])
  const targetIds = new Set(runs.map(run => run.targetDeviceId))
  const targets = Object.fromEntries(
    [...applications, ...external].filter(app => targetIds.has(app.id)).map(app => [app.id, app.name])
  )
  return { runs, targets }
}
