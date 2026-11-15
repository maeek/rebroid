'use client'

import { IconDeviceDesktop, IconDeviceMobile, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { MutationButton } from '@/components/ui/mutation-button'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const DisplaySwitcher = ({
  activeSurfaceId,
  surfaces,
  onSelect
}: {
  activeSurfaceId?: string
  surfaces: DisplayViewerSurface[]
  onSelect: (surfaceId: string) => void
}) => (
  <div
    role='group'
    aria-label='Active display'
    className='flex max-w-full items-center gap-1'
  >
    {surfaces.map(surface => {
      const active = activeSurfaceId === surface.id
      const Icon = surface.kind === 'main' ? IconDeviceMobile : IconDeviceDesktop
      return (
        <Button
          key={surface.id}
          type='button'
          size='sm'
          variant={active ? 'secondary' : 'ghost'}
          aria-pressed={active}
          onClick={() => onSelect(surface.id)}
          className='min-w-0 shrink justify-start text-xs'
        >
          <Icon aria-hidden />
          <span className='truncate'>{surface.name}</span>
        </Button>
      )
    })}
  </div>
)

export const AddVirtualDisplay = ({
  loading,
  pending,
  onAdd
}: {
  loading?: boolean
  pending?: boolean
  onAdd?: () => void
}) => (
  <div className='flex shrink-0 items-center px-2 pt-2'>
    <MutationButton
      type='button'
      size='sm'
      variant='secondary'
      disabled={loading}
      pending={pending}
      pendingLabel='Adding virtual display…'
      onClick={onAdd}
      className='text-xs'
    >
      <IconPlus aria-hidden />
      Add virtual display
    </MutationButton>
  </div>
)
