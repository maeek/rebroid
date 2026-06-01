'use client'

import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QuickGlanceCard } from '@/features/settings/components/quick-glance-card'
import { formatDateLocale } from '@/lib/format'
import type { SystemResources } from '@/server/orchestrator/diagnostics/types'

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(2)} ${units[index]}`
}

export const OrchestratorResources = ({
  resources,
  isRefreshing,
  onRefresh
}: {
  resources?: SystemResources
  isRefreshing?: boolean
  onRefresh?: (refreshVolumes?: boolean) => Promise<void>
}) => {
  const volumeCacheLabel = resources?.volumeUsageCachedAt ? formatDateLocale(resources.volumeUsageCachedAt) : 'never'

  return (
    <Section
      title='Managed inventory and storage'
      titleClassName='pb-4'
      contentClassName='gap-4'
      className='w-full'
    >
      <div className='grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-sm:grid-cols-1'>
        <QuickGlanceCard
          label='Containers'
          value={resources?.containersTotal ?? 0}
          hint='Managed containers visible to Docker'
        />
        <QuickGlanceCard
          label='Running'
          value={resources?.containersRunning ?? 0}
          hint='Managed containers currently running'
        />
        <QuickGlanceCard
          label='Volumes'
          value={resources?.managedVolumesTotal ?? 0}
          hint='Managed persistent volumes'
        />
        <QuickGlanceCard
          label='Volume size'
          value={formatBytes(resources?.managedVolumesSizeBytes ?? 0)}
          hint={`Cached at ${volumeCacheLabel}`}
          headerAction={
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-7 text-secondary-foreground'
                    aria-label='Refresh volume sizes'
                    disabled={isRefreshing}
                    onClick={() => void onRefresh?.(true)}
                  >
                    {isRefreshing ? (
                      <IconLoader2 className='size-4 animate-spin' />
                    ) : (
                      <IconRefresh className='size-4' />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Refresh cached volume sizes</TooltipContent>
            </Tooltip>
          }
        />
      </div>
    </Section>
  )
}
