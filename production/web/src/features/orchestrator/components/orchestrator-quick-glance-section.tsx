'use client'

import { useEffect, useState } from 'react'
import { Visible } from '@/components/ui/visible'
import { QuickGlanceCard } from '@/features/settings/components/quick-glance-card'
import { getDisplayErrorMessage } from '@/lib/error-utils'
import { formatDateLocale } from '@/lib/format'
import { getSystemResourcesAction } from '@/server/orchestrator/diagnostics/actions'
import type { SystemResources } from '@/server/orchestrator/diagnostics/types'

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const valueOrUnavailable = (value: string | undefined, error: string | null) => {
  if (value) {
    return value
  }

  return error ? 'Unavailable' : 'Loading...'
}

const loadingHint = (loading: string, error: string | null, errorHint: string) => {
  if (error) {
    return errorHint
  }

  return loading
}

export const OrchestratorQuickGlanceSection = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [resources, setResources] = useState<SystemResources>()
  const [error, setError] = useState<string | null>(null)

  const cpuHint = () => {
    if (!resources) {
      return loadingHint('Collecting live Docker stats', error, 'Live Docker stats could not be collected')
    }

    return resources.containersRunning > 0
      ? `Aggregated live usage across ${resources.containersRunning} running containers`
      : 'No running managed containers'
  }

  const memoryHint = () => {
    if (!resources) {
      return loadingHint('Collecting live Docker stats', error, 'Live Docker stats could not be collected')
    }

    return resources.containersRunning > 0
      ? 'Aggregated working-set memory from live Docker container stats'
      : 'No running managed containers'
  }

  const volumeHint = () => {
    if (!resources) {
      return loadingHint('Refreshing storage usage', error, 'Storage usage could not be refreshed')
    }

    return `${resources.managedVolumesTotal} managed volumes`
  }

  useEffect(() => {
    const refresh = async (refreshVolumes = false) => {
      try {
        setResources(await getSystemResourcesAction(refreshVolumes))
        setError(null)
      } catch (caughtError) {
        setError(getDisplayErrorMessage(caughtError, 'Could not load orchestrator resources.'))
      }
    }

    void refresh(refreshKey > 0)
    const interval = window.setInterval(() => void refresh(false), 15000)

    return () => window.clearInterval(interval)
  }, [refreshKey])

  return (
    <>
      <Visible when={error}>
        <div className='rounded-lg border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
          {error}
        </div>
      </Visible>
      <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          label='Managed container CPU'
          value={valueOrUnavailable(
            resources ? formatPercent(resources.managedContainersCpuUsagePercent) : undefined,
            error
          )}
          hint={cpuHint()}
        />
        <QuickGlanceCard
          label='Managed container memory'
          value={valueOrUnavailable(
            resources ? formatBytes(resources.managedContainersMemoryUsageBytes) : undefined,
            error
          )}
          hint={memoryHint()}
        />
        <QuickGlanceCard
          label='Containers'
          value={valueOrUnavailable(
            resources ? `${resources.containersRunning}/${resources.containersTotal}` : undefined,
            error
          )}
          hint='Running / Total'
        />
        <QuickGlanceCard
          label='Managed volume size'
          value={valueOrUnavailable(resources ? formatBytes(resources.managedVolumesSizeBytes) : undefined, error)}
          hint={volumeHint()}
        />
      </div>
      <div className='text-xs text-secondary-foreground'>
        Container stats are sampled live when this panel refreshes.
        {resources?.containerStatsCollectedAt
          ? ` Last sample: ${formatDateLocale(resources.containerStatsCollectedAt)}`
          : ''}
        {resources?.volumeUsageCachedAt
          ? ` • Volume sizes cached at ${formatDateLocale(resources.volumeUsageCachedAt)}`
          : ''}
      </div>
    </>
  )
}
