import {
  getPlatformContainerAction,
  getPlatformContainerLogsAction
} from '@/server/orchestrator/platform/container-actions'
import type { ContainerResourceView } from '@/shared/model/container-resource-href'

export const loadRuntimeContainerDetailPageData = async (id: string, view: ContainerResourceView = 'overview') => {
  const details = await getPlatformContainerAction(id)
  return { details, pendingLogs: view === 'logs' ? getPlatformContainerLogsAction(id) : undefined }
}
