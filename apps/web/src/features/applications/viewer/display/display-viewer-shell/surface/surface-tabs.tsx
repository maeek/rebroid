'use client'

import { IconLoader2, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Visible } from '@/components/ui/visible'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const SurfaceTabs = ({
  activeSurface,
  isAddingDisplay,
  surfaces,
  onAddDisplay,
  onSelectSurface,
  onScrollSurfaceIntoView
}: {
  activeSurface?: DisplayViewerSurface
  isAddingDisplay: boolean
  surfaces: DisplayViewerSurface[]
  onAddDisplay: () => void
  onSelectSurface: (surfaceId: string) => void
  onScrollSurfaceIntoView: (surfaceId: string) => void
}) => (
  <div className='flex shrink-0 items-center justify-between gap-3 px-2 pt-2 sm:px-6 sm:pt-3'>
    <div className='flex min-w-0 items-center gap-2 overflow-x-auto'>
      <Visible when={!surfaces.some(item => item.kind === 'virtual')}>
        <Button
          type='button'
          size='sm'
          variant='secondary'
          disabled={isAddingDisplay}
          onClick={onAddDisplay}
          className='h-8 shrink-0 gap-1.5 px-3 text-xs'
        >
          {isAddingDisplay ? <IconLoader2 className='size-3.5 animate-spin' /> : <IconPlus className='size-3.5' />}
          Add display
        </Button>
      </Visible>
      {surfaces.map(surface => (
        <Button
          key={surface.id}
          type='button'
          size='sm'
          variant={surface.id === activeSurface?.id ? 'secondary' : 'ghost'}
          onClick={() => {
            onSelectSurface(surface.id)
            onScrollSurfaceIntoView(surface.id)
          }}
          className='h-8 shrink-0 gap-1.5 px-3 text-xs'
        >
          <span className='max-w-28 truncate'>{surface.name}</span>
        </Button>
      ))}
    </div>
  </div>
)
