import 'server-only'
import { requireAdmin } from '@/server/auth/authorization'
import { orchestratorPlatformClient } from '@/server/orchestrator/platform/client'
import {
  getPlatformContainerAction,
  getPlatformContainerLogsAction
} from '@/server/orchestrator/platform/container-actions'
import type { ContainerResourceView } from '@/shared/model/container-resource-href'

export const loadRuntimeContainerDetailPageData = async (id: string, view: ContainerResourceView = 'overview') => {
  if (view === 'overview') return { view, details: await getPlatformContainerAction(id) }

  await requireAdmin()
  const summary = await orchestratorPlatformClient.getPlatformContainerSummary(id)
  if (view === 'logs') return { view, summary, pendingLogs: getPlatformContainerLogsAction(summary.container.id) }
  return { view, summary }
}
