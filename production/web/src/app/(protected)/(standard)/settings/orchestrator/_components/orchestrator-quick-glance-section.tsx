'use client'

import { useEffect, useState } from 'react'
import { getSystemResourcesAction } from '@/lib/orchestrator/actions'
import { QuickGlanceCard } from '../../../../_components/settings/quick-glance-card'
import type { SystemResources } from '@/lib/orchestrator/types'

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`

export const OrchestratorQuickGlanceSection = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [resources, setResources] = useState<SystemResources>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const refresh = async (refreshVolumes = false) => {
      try {
        setResources(await getSystemResourcesAction(refreshVolumes))
        setError(null)
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load orchestrator resources.')
      }
    }

    void refresh(refreshKey > 0)
    const interval = window.setInterval(() => void refresh(false), 15000)

    return () => window.clearInterval(interval)
  }, [refreshKey])

  return (
    <>
      {error && (
        <div className='rounded-lg border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive'>
          {error}
        </div>
      )}
      <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          label='Managed container CPU'
          value={resources ? formatPercent(resources.managedContainersCpuUsagePercent) : 'Loading...'}
          hint={
            resources
              ? resources.containersRunning > 0
                ? `Aggregated live usage across ${resources.containersRunning} running containers`
                : 'No running managed containers'
              : 'Collecting live Docker stats'
          }
        />
        <QuickGlanceCard
          label='Managed container memory'
          value={resources ? formatBytes(resources.managedContainersMemoryUsageBytes) : 'Loading...'}
          hint={
            resources
              ? resources.containersRunning > 0
                ? 'Aggregated working-set memory from live Docker container stats'
                : 'No running managed containers'
              : 'Collecting live Docker stats'
          }
        />
        <QuickGlanceCard
          label='Containers'
          value={resources ? `${resources.containersRunning}/${resources.containersTotal}` : 'Loading...'}
          hint='Running / Total'
        />
        <QuickGlanceCard
          label='Managed volume size'
          value={resources ? formatBytes(resources.managedVolumesSizeBytes) : 'Loading...'}
          hint={resources ? `${resources.managedVolumesTotal} managed volumes` : 'Refreshing storage usage'}
        />
      </div>
      <div className='text-xs text-secondary-foreground'>
        Container stats are sampled live when this panel refreshes.
        {resources?.containerStatsCollectedAt
          ? ` Last sample: ${new Date(resources.containerStatsCollectedAt).toLocaleString()}`
          : ''}
        {resources?.volumeUsageCachedAt
          ? ` • Volume sizes cached at ${new Date(resources.volumeUsageCachedAt).toLocaleString()}`
          : ''}
      </div>
    </>
  )
}
