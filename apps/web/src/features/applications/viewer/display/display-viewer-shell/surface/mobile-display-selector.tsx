'use client'

import { IconChevronDown, IconLoader2, IconPlus, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useDisplayViewerContext } from '../display-viewer-context'

export const MobileDisplaySelector = ({ canAddDisplay }: { canAddDisplay: boolean }) => {
  const { activeSurface, canControl, orderedSurfaces, setActiveSurfaceId, viewerActions } = useDisplayViewerContext()
  const virtual = canControl ? orderedSurfaces.find(surface => surface.kind === 'virtual') : undefined
  const pending = viewerActions.isAddingDisplay || viewerActions.closingSurfaceId !== null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='h-11 min-w-0 max-w-full gap-1 px-2 text-sm'
          aria-busy={pending}
        >
          <span className='truncate'>{activeSurface?.name ?? 'Display'}</span>
          {pending ? (
            <IconLoader2
              aria-hidden
              className='shrink-0 motion-safe:animate-spin'
            />
          ) : (
            <IconChevronDown
              aria-hidden
              className='shrink-0 text-foreground-muted'
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align='end'
        className='min-w-48'
      >
        <DropdownMenuRadioGroup
          value={activeSurface?.id}
          onValueChange={setActiveSurfaceId}
          aria-label='Active display'
        >
          {orderedSurfaces.map(surface => (
            <DropdownMenuRadioItem
              key={surface.id}
              value={surface.id}
              className='min-h-11'
            >
              {surface.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {canAddDisplay || virtual ? <DropdownMenuSeparator /> : null}
        {canAddDisplay ? (
          <DropdownMenuItem
            className='min-h-11'
            disabled={pending}
            onClick={viewerActions.addDisplay}
          >
            <IconPlus aria-hidden />
            {viewerActions.isAddingDisplay ? 'Adding virtual display…' : 'Add virtual display'}
          </DropdownMenuItem>
        ) : null}
        {virtual ? (
          <DropdownMenuItem
            className='min-h-11'
            disabled={pending}
            onClick={() => viewerActions.closeDisplay(virtual)}
          >
            <IconX aria-hidden />
            {pending ? 'Closing virtual display…' : 'Close virtual display'}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
