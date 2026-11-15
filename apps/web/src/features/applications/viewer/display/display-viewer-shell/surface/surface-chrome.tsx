'use client'

import type { ReactNode } from 'react'
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconExternalLink,
  IconInfoCircle,
  IconLoader2,
  IconX
} from '@tabler/icons-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { ViewerActionBar } from '@/features/applications/viewer/components/viewer-action-bar'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import { cn } from '@/lib/utils'
import type { DisplayViewerStreamStatus } from '@/features/applications/viewer/display/display-viewer-stream-status'
import type { DisplayViewerSurface } from '@/features/applications/viewer/display/display-viewer-surfaces'

const streamStatusLabel = (status: DisplayViewerStreamStatus) => {
  if (status.code === 'audio-disabled') {
    return 'Audio disabled'
  }
  if (status.code === 'reconnecting') {
    return 'Reconnecting'
  }
  if (status.code === 'video-stalled') {
    return 'Stream recovering'
  }
  return 'Stream issue'
}

export const StreamStatusIndicator = ({ status }: { status: DisplayViewerStreamStatus }) => {
  const isInfo = status.severity === 'info'
  const Icon = isInfo ? IconInfoCircle : IconAlertTriangle

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'flex h-5 min-w-0 items-center gap-1 rounded-full border px-1.5 text-[0.68rem] font-medium leading-none',
            isInfo ? 'border-primary/30 bg-primary/10 text-primary' : 'border-warning/40 bg-warning/10 text-warning'
          )}
        >
          <Icon className='size-3 shrink-0' />
          <span className='max-w-28 truncate'>{streamStatusLabel(status)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{status.message}</TooltipContent>
    </Tooltip>
  )
}

export const SurfaceChrome = ({
  showName,
  actions,
  isClosing,
  isFullscreen,
  streamStatus,
  surface,
  onClose,
  onOpenPopout,
  onToggleFullscreen
}: {
  showName: boolean
  actions?: ReactNode
  isClosing: boolean
  isFullscreen: boolean
  streamStatus?: DisplayViewerStreamStatus
  surface: DisplayViewerSurface
  onClose: () => void
  onOpenPopout: () => void
  onToggleFullscreen: () => void
}) => (
  <ViewerActionBar className='justify-between'>
    <div className='flex min-w-0 items-center gap-1.5 overflow-hidden'>
      {showName ? <span className='max-w-32 truncate text-xs font-medium'>{surface.name}</span> : null}
      <Visible when={Boolean(streamStatus)}>
        {streamStatus ? <StreamStatusIndicator status={streamStatus} /> : null}
      </Visible>
    </div>
    <div className='flex shrink-0 items-center gap-1'>
      {actions}
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
  </ViewerActionBar>
)
