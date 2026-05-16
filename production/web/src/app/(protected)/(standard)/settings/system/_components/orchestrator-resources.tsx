'use client'

import { IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { SystemResources } from '@/lib/orchestrator/types'

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
  const volumeCacheLabel = resources?.volumeUsageCachedAt
    ? new Date(resources.volumeUsageCachedAt).toLocaleString()
    : 'never'

  return (
    <Section
      title='Managed inventory and storage'
      contentClassName='gap-4'
      className='w-full'
    >
      <div className='grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1'>
        <div className='rounded-md border border-input bg-card/40 p-3'>
          <div className='text-sm text-secondary-foreground'>Containers</div>
          <div className='text-2xl font-medium'>{resources?.containersTotal ?? 0}</div>
        </div>
        <div className='rounded-md border border-input bg-card/40 p-3'>
          <div className='text-sm text-secondary-foreground'>Running</div>
          <div className='text-2xl font-medium'>{resources?.containersRunning ?? 0}</div>
        </div>
        <div className='rounded-md border border-input bg-card/40 p-3'>
          <div className='text-sm text-secondary-foreground'>Volumes</div>
          <div className='text-2xl font-medium'>{resources?.managedVolumesTotal ?? 0}</div>
        </div>
        <div className='rounded-md border border-input bg-card/40 p-3'>
          <div className='flex items-start justify-between gap-2'>
            <div className='text-sm text-secondary-foreground'>Volume size</div>
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
                    <IconRefresh className={isRefreshing ? 'size-4 animate-spin' : 'size-4'} />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Refresh cached volume sizes</TooltipContent>
            </Tooltip>
          </div>
          <div className='text-2xl font-medium'>{formatBytes(resources?.managedVolumesSizeBytes ?? 0)}</div>
          <div className='mt-1 text-xs text-secondary-foreground'>Cached at {volumeCacheLabel}</div>
        </div>
      </div>
    </Section>
  )
}
