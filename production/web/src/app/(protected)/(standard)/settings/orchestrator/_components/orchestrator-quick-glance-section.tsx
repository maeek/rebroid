'use client'

import { useEffect, useState } from 'react'
import { getSystemResourcesAction } from '@/lib/orchestrator/actions'
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

const QuickGlanceCard = ({ label, value, hint }: { label: string; value: string; hint: string }) => {
  return (
    <div className='rounded-md border border-border/60 border-l-primary/50 p-4 bg-card/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-md max-sm:p-4'>
      <div className='text-sm font-medium text-secondary-foreground'>{label}</div>
      <div className='mt-1 text-2xl font-semibold text-foreground'>{value}</div>
      <div className='mt-2 text-xs leading-5 text-muted-foreground'>{hint}</div>
    </div>
  )
}

export const OrchestratorQuickGlanceSection = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [resources, setResources] = useState<SystemResources>()

  useEffect(() => {
    const refresh = async (refreshVolumes = false) => {
      setResources(await getSystemResourcesAction(refreshVolumes))
    }

    void refresh(refreshKey > 0)
    const interval = window.setInterval(() => void refresh(false), 15000)

    return () => window.clearInterval(interval)
  }, [refreshKey])

  return (
    <>
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
          hint='running / total'
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
