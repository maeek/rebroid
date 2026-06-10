'use client'

import { IconArrowsMaximize, IconArrowsMinimize, IconExternalLink, IconLoader2, IconX } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import { cn } from '@/lib/utils'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

export const SurfaceChrome = ({
  isActive,
  isClosing,
  isFullscreen,
  surface,
  onClose,
  onOpenPopout,
  onToggleFullscreen
}: {
  isActive: boolean
  isClosing: boolean
  isFullscreen: boolean
  surface: DisplayViewerSurface
  onClose: () => void
  onOpenPopout: () => void
  onToggleFullscreen: () => void
}) => (
  <div
    className={cn(
      'flex h-7 shrink-0 items-center justify-between gap-2 rounded-t-lg border border-b-0 border-border/70 bg-card/90 px-1.5 text-foreground shadow-md backdrop-blur-md',
      'w-full min-w-0',
      isActive && 'bg-secondary/80'
    )}
  >
    <div className='flex min-w-0 items-center gap-1.5 overflow-x-auto'>
      <span className='max-w-32 truncate text-xs font-medium'>{surface.name}</span>
    </div>
    <div className='flex shrink-0 items-center gap-1'>
      <IconActionButton
        label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <IconArrowsMinimize className='size-3.5' /> : <IconArrowsMaximize className='size-3.5' />}
      </IconActionButton>
      <IconActionButton
        label='Open viewer in new window'
        onClick={onOpenPopout}
      >
        <IconExternalLink className='size-3.5' />
      </IconActionButton>
      <Visible when={surface.kind === 'virtual'}>
        <IconActionButton
          label='Close virtual display'
          disabled={isClosing}
          onClick={onClose}
        >
          {isClosing ? <IconLoader2 className='size-3.5 animate-spin' /> : <IconX className='size-3.5' />}
        </IconActionButton>
      </Visible>
    </div>
  </div>
)
