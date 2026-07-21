import type { DisplaySidecarSession } from '@/shared/contracts/diagnostics'
import type { SortingState } from '@tanstack/react-table'

export const formatTimestamp = (value: string) => new Date(value).toLocaleString()

export const castingMessage = (message: string) => message.replace(/display sidecar/gi, 'casting sidecar')

export const castingErrorMessage = (error: unknown) =>
  castingMessage(error instanceof Error ? error.message : 'Unknown error')

export const formatHealthDetail = (value: unknown) => {
  if (value === null) return 'none'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export const activeStatuses = new Set(['created', 'active'])

export const castingDetailLabels: Record<string, string> = {
  autoStart: 'Auto start',
  containerId: 'Container ID',
  containerName: 'Container name',
  error: 'Error',
  exitCode: 'Exit code',
  finishedAt: 'Finished at',
  image: 'Image',
  port: 'Port',
  publishedHostPort: 'Published host port',
  recentLogs: 'Recent logs',
  restartCount: 'Restart count'
}

export const sortSessions = (sessions: DisplaySidecarSession[], sorting: SortingState) => {
  const activeSorting = sorting.length > 0 ? sorting : [{ id: 'lastActivityAt', desc: true }]
  return [...sessions].sort((left, right) => {
    for (const item of activeSorting) {
      const multiplier = item.desc ? -1 : 1
      let result = 0
      if (item.id === 'application') result = (left.applicationId ?? '').localeCompare(right.applicationId ?? '')
      else if (item.id === 'id') result = left.id.localeCompare(right.id)
      else if (item.id === 'status') result = left.status.localeCompare(right.status)
      else if (item.id === 'lastActivityAt') {
        result = new Date(left.lastActivityAt).getTime() - new Date(right.lastActivityAt).getTime()
      } else if (item.id === 'expiresAt') {
        result = new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime()
      }
      if (result !== 0) return result * multiplier
    }
    return left.id.localeCompare(right.id)
  })
}

export const filterSessions = <TApp extends { id: string; name: string }>(
  sessions: DisplaySidecarSession[],
  appsById: Map<string, TApp>,
  search: string
) => {
  const query = search.trim().toLowerCase()
  if (!query) return sessions
  return sessions.filter(session => {
    const app = session.applicationId ? appsById.get(session.applicationId) : undefined
    return [session.id, session.applicationId, app?.name, session.ownerUserId, session.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
}
