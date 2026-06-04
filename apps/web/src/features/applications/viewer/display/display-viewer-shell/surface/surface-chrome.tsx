'use client'

import { IconArrowsMaximize, IconArrowsMinimize, IconExternalLink, IconLoader2, IconX } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import { cn } from '@/lib/utils'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const SurfaceChrome = ({
  isActive,
  isClosing,
  fullscreen,
  surface,
  onClose,
  onToggleFullscreen,
  onOpenPopout
}: {
  isActive: boolean
  isClosing: boolean
  fullscreen: boolean
  surface: DisplayViewerSurface
  onClose: () => void
  onToggleFullscreen: () => void
  onOpenPopout: () => void
}) => (
  <div
    className={cn(
      'flex h-10 shrink-0 items-center justify-between gap-3 rounded-t-lg border border-b-0 border-border/70 bg-card/90 px-2 text-foreground shadow-lg backdrop-blur-md',
      'w-full min-w-0',
      isActive && 'bg-secondary/80'
    )}
  >
    <div className='flex min-w-0 items-center gap-2 overflow-x-auto'>
      <span className='max-w-32 truncate text-sm font-medium'>{surface.name}</span>
    </div>
    <div className='flex shrink-0 items-center gap-1.5'>
      <IconActionButton
        label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onClick={onToggleFullscreen}
      >
        {fullscreen ? <IconArrowsMinimize className='size-4' /> : <IconArrowsMaximize className='size-4' />}
      </IconActionButton>
      <IconActionButton
        label='Open viewer in new window'
        onClick={onOpenPopout}
      >
        <IconExternalLink className='size-4' />
      </IconActionButton>
      <Visible when={surface.kind === 'virtual'}>
        <IconActionButton
          label='Close virtual display'
          disabled={isClosing}
          onClick={onClose}
        >
          {isClosing ? <IconLoader2 className='size-4 animate-spin' /> : <IconX className='size-4' />}
        </IconActionButton>
      </Visible>
    </div>
  </div>
)
