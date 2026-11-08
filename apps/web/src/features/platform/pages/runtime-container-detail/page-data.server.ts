import {
  getPlatformContainerAction,
  getPlatformContainerLogsAction
} from '@/server/orchestrator/platform/container-actions'

export const loadRuntimeContainerDetailPageData = async (id: string, view: 'overview' | 'logs' = 'overview') => {
  const [details, logs] = await Promise.all([
    getPlatformContainerAction(id),
    view === 'logs' ? getPlatformContainerLogsAction(id) : undefined
  ])

  return {
    details,
    logs,
    name: details.container.names[0] ?? details.container.shortId
  }
}
