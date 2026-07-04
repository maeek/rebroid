import { buildPlatformGridHref, summarizePlatformBulkActionResults } from './runtime-grid-query-utils'
import type { ActionResult } from '@/shared/actions/action-result'
import type { PlatformContainer, PlatformContainersGridQuery } from '@/server/orchestrator/platform/types'

type ContainersGridHrefInput = {
  gridQuery: PlatformContainersGridQuery
  pageSize: number
  patch: Partial<PlatformContainersGridQuery>
}

export type ContainerBulkActionType = 'stop' | 'remove'

export const buildContainersGridHref = ({ gridQuery, pageSize, patch }: ContainersGridHrefInput) =>
  buildPlatformGridHref({
    basePath: '/runtime/containers',
    gridQuery,
    pageSize,
    patch
  })

export const canRunBulkContainerAction = (containers: PlatformContainer[]) => containers.length > 0

export const shouldStopContainerInBulkAction = (container: PlatformContainer) => container.state === 'running'

export const selectVisibleOrphanedContainerIds = (containers: PlatformContainer[], selectedIds: Set<string>) => {
  const next = new Set(selectedIds)
  for (const container of containers) {
    if (container.orphaned) {
      next.add(container.id)
    }
  }
  return next
}

export const summarizeContainerBulkActionResults = (
  results: Array<PromiseSettledResult<unknown> | ActionResult<unknown>>,
  type: ContainerBulkActionType
) =>
  summarizePlatformBulkActionResults(
    results,
    type === 'stop' ? 'Selected containers stopped' : 'Selected containers removed',
    type === 'stop' ? 'Some containers could not be stopped' : 'Some containers could not be removed'
  )
