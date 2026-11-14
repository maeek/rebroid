import {
  getPlatformContainerAction,
  getPlatformContainerLogsAction
} from '@/server/orchestrator/platform/container-actions'
import { OrchestratorRequestError } from '@/server/orchestrator/request'
import type { ContainerResourceView } from '@/shared/model/container-resource-href'

const loadContainerLogs = async (id: string) => {
  try {
    return { logs: await getPlatformContainerLogsAction(id), logReadLimitExceeded: false }
  } catch (error) {
    if (error instanceof OrchestratorRequestError && error.status === 413) {
      return { logs: undefined, logReadLimitExceeded: true }
    }
    throw error
  }
}

export const loadRuntimeContainerDetailPageData = async (id: string, view: ContainerResourceView = 'overview') => {
  const [details, logResult] = await Promise.all([
    getPlatformContainerAction(id),
    view === 'logs' ? loadContainerLogs(id) : undefined
  ])

  return {
    details,
    logs: logResult?.logs,
    logReadLimitExceeded: logResult?.logReadLimitExceeded,
    name: details.container.names[0] ?? details.container.shortId
  }
}
