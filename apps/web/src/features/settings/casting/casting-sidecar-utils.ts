import type { AndroidApplication } from '@/shared/contracts/application'
import type { DisplaySidecarSession } from '@/shared/contracts/diagnostics'
import type { SortingState } from '@tanstack/react-table'

export const formatTimestamp = (value: string) => new Date(value).toLocaleString()

export const castingErrorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : 'Unknown error').replace(/display sidecar/gi, 'casting sidecar')

export const formatHealthDetail = (value: unknown) => {
  if (value === null) return 'none'
  if (typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  return undefined
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
  containerStatus: 'Container status',
  oomKilled: 'Killed for running out of memory',
  startedAt: 'Started at',
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

export type CastingApplication = Pick<AndroidApplication, 'id' | 'name' | 'ownerUserId'>

export const sessionOwnerId = (session: DisplaySidecarSession, app?: CastingApplication) =>
  session.ownerUserId ?? app?.ownerUserId

export const filterSessions = (
  sessions: DisplaySidecarSession[],
  appsById: ReadonlyMap<string, CastingApplication>,
  { search, status, applicationId, ownerId }: { search: string; status: string; applicationId: string; ownerId: string }
) => {
  const query = search.trim().toLowerCase()
  return sessions.filter(session => {
    if (status !== 'all' && session.status !== status) return false
    if (applicationId !== 'all' && session.applicationId !== applicationId) return false
    const app = session.applicationId ? appsById.get(session.applicationId) : undefined
    const owner = sessionOwnerId(session, app)
    if (ownerId !== 'all' && owner !== ownerId) return false
    if (!query) return true
    return [session.id, session.applicationId, session.deviceName ?? app?.name, owner, session.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
}
