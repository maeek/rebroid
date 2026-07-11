import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { formatPlatformBytes, formatPlatformDate } from '@/shared/ui/platform/platform-detail-parts'
import type { PlatformContainerDetails, PlatformContainerStats } from '@/server/orchestrator/platform/types'

export const containerStatsRefreshIntervalMs = 15_000

export type ContainerPendingAction = 'stop' | 'remove'

export const actionDialogCopy: Record<
  ContainerPendingAction,
  {
    title: string
    description: string
    errorTitle: string
    buttonVariant: 'secondary' | 'danger'
  }
> = {
  stop: {
    title: 'Stop container?',
    description: 'This stops the selected Docker container without deleting it.',
    errorTitle: 'Could not stop container',
    buttonVariant: 'secondary'
  },
  remove: {
    title: 'Remove container?',
    description:
      'Remove the selected Docker container. Enable force removal when Docker reports the container as stuck in removing or when a normal removal does not complete.',
    errorTitle: 'Could not remove container',
    buttonVariant: 'danger'
  }
}

export const formatContainerNetworks = (networks: PlatformContainerDetails['container']['networks']) =>
  networks.length > 0 ? networks.join(', ') : 'none'

export const formatContainerPorts = (ports: PlatformContainerDetails['container']['ports']) =>
  ports.length > 0
    ? ports.map(port => `${port.ip ?? '*'}:${port.publicPort ?? '-'} -> ${port.privatePort}/${port.type}`).join(', ')
    : 'none'

export const formatStatsSample = (
  containerState: PlatformContainerDetails['container']['state'],
  stats?: PlatformContainerStats
) => {
  if (stats) {
    return `Last sample: ${formatPlatformDate(stats.collectedAt)}`
  }

  return containerState === 'running'
    ? 'Collecting live Docker stats...'
    : 'Live Docker stats are available while the container is running.'
}

export const getMemoryStatsHint = (stats?: PlatformContainerStats) =>
  stats?.memoryLimitBytes
    ? `${formatPlatformBytes(stats.memoryLimitBytes)} Docker limit`
    : 'Working-set memory from Docker stats'

export const getCpuStatsHint = (containerState: PlatformContainerDetails['container']['state']) =>
  containerState === 'running' ? 'Live Docker CPU usage' : 'Container is not running'

export const formatCpuStatsValue = (stats?: PlatformContainerStats) =>
  stats ? `${stats.cpuUsagePercent.toFixed(1)}%` : 'Unavailable'

export const formatByteStatsValue = (value?: number) =>
  value === undefined ? 'Unavailable' : formatPlatformBytes(value)

export const isStatsRefreshDisabled = (
  containerState: PlatformContainerDetails['container']['state'],
  isRefreshingStats: boolean
) => containerState !== 'running' || isRefreshingStats

export const getRefreshIcon = (isRefreshingStats: boolean) =>
  isRefreshingStats ? <IconLoader2 className='size-4 animate-spin' /> : <IconRefresh className='size-4' />

export const getRelatedImageTags = (relatedImage?: PlatformContainerDetails['relatedImage']) =>
  relatedImage?.repoTags.join(', ') || relatedImage?.shortId || 'unknown'

export const getRelatedImageSize = (relatedImage?: PlatformContainerDetails['relatedImage']) =>
  relatedImage ? `${(relatedImage.sizeBytes / 1024 / 1024).toFixed(2)} MB` : 'unknown'

export const getActionButtonLabel = (pendingAction: ContainerPendingAction, forceRemove: boolean) => {
  if (pendingAction === 'stop') {
    return 'Stop container'
  }

  return forceRemove ? 'Force remove container' : 'Remove container'
}
