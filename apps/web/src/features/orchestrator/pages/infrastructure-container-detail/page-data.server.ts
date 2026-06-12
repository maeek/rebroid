import {
  getPlatformContainerAction,
  getPlatformContainerLogsAction
} from '@/server/orchestrator/platform/container-actions'

export const loadInfrastructureContainerDetailPageData = async (id: string) => {
  const [details, logs] = await Promise.all([getPlatformContainerAction(id), getPlatformContainerLogsAction(id)])

  return {
    details,
    logs,
    name: details.container.names[0] ?? details.container.shortId
  }
}
