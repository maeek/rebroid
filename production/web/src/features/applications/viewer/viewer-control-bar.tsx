'use client'

import { useState, useTransition } from 'react'
import type { ReactNode } from 'react'
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBell,
  IconDeviceMobileRotated,
  IconHome,
  IconLayoutSidebarRight,
  IconLoader2,
  IconPhoto,
  IconPlayerTrackNext,
  IconPower,
  IconVolume,
  IconVolume2,
  IconVolumeOff
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { sendApplicationViewerControlAction } from '@/server/orchestrator/applications/mutation-actions'
import type { ApplicationViewerControlCommand } from '@/server/orchestrator/applications/types'

const controlErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : ''
  return message || 'The server did not return details for this failure.'
}

const IconButtonTooltip = ({ label, children }: { label: string; children: ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

type ViewerControlBarProps = {
  appId: string
  runtimeAvailable: boolean
  canControl: boolean
  canCaptureScreenshot: boolean
  hideOutline: boolean
  fullscreen: boolean
  isCapturing: boolean
  onCaptureScreenshot: () => void
  onToggleFrame: () => void
  onToggleFullscreen: () => void
  onRotateViewer?: () => void
}

export const ViewerControlBar = ({
  appId,
  runtimeAvailable,
  canControl,
  canCaptureScreenshot,
  hideOutline,
  fullscreen,
  isCapturing,
  onCaptureScreenshot,
  onToggleFrame,
  onToggleFullscreen,
  onRotateViewer
}: ViewerControlBarProps) => {
  const [pendingCommand, setPendingCommand] = useState<ApplicationViewerControlCommand | null>(null)
  const [isPending, startTransition] = useTransition()
  const controlsDisabled = !runtimeAvailable || !canControl || isPending

  const sendControl = (command: ApplicationViewerControlCommand) => {
    if (controlsDisabled) {
      return
    }

    setPendingCommand(command)
    startTransition(async () => {
      try {
        await sendApplicationViewerControlAction(appId, command)
        if (command === 'rotate') {
          onRotateViewer?.()
        }
      } catch (error) {
        toast({
          title: 'Viewer command failed',
          description: controlErrorDescription(error),
          variant: 'destructive'
        })
      } finally {
        setPendingCommand(null)
      }
    })
  }

  const controlIcon = (command: ApplicationViewerControlCommand, icon: ReactNode) =>
    pendingCommand === command ? <IconLoader2 className='size-4 animate-spin' /> : icon

  return (
    <div className='flex w-full flex-wrap items-center justify-center gap-2 pb-2'>
      <Visible when={runtimeAvailable && canCaptureScreenshot}>
        <IconButtonTooltip label='Capture screenshot'>
          <Button
            size='icon'
            variant='secondary'
            disabled={isCapturing}
            onClick={onCaptureScreenshot}
            aria-label='Capture screenshot'
          >
            {isCapturing ? <IconLoader2 className='size-4 animate-spin' /> : <IconPhoto className='size-4' />}
          </Button>
        </IconButtonTooltip>
      </Visible>

      <div className='flex items-center rounded-md border border-border/60 bg-secondary/35 p-1'>
        <IconButtonTooltip label='Back'>
          <Button
            size='icon'
            variant='ghost'
            disabled={controlsDisabled}
            onClick={() => sendControl('back')}
            aria-label='Back'
            className='size-8'
          >
            {controlIcon('back', <IconPlayerTrackNext className='size-4 rotate-180' />)}
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label='Home'>
          <Button
            size='icon'
            variant='ghost'
            disabled={controlsDisabled}
            onClick={() => sendControl('home')}
            aria-label='Home'
            className='size-8'
          >
            {controlIcon('home', <IconHome className='size-4' />)}
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label='Recent apps'>
          <Button
            size='icon'
            variant='ghost'
            disabled={controlsDisabled}
            onClick={() => sendControl('recents')}
            aria-label='Recent apps'
            className='size-8'
          >
            {controlIcon('recents', <IconLayoutSidebarRight className='size-4' />)}
          </Button>
        </IconButtonTooltip>
      </div>

      <div className='flex items-center rounded-md border border-border/60 bg-secondary/35 p-1'>
        <IconButtonTooltip label='Volume down'>
          <Button
            size='icon'
            variant='ghost'
            disabled={controlsDisabled}
            onClick={() => sendControl('volume-down')}
            aria-label='Volume down'
            className='size-8'
          >
            {controlIcon('volume-down', <IconVolume className='size-4' />)}
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label='Mute device'>
          <Button
            size='icon'
            variant='ghost'
            disabled={controlsDisabled}
            onClick={() => sendControl('mute')}
            aria-label='Mute device'
            className='size-8'
          >
            {controlIcon('mute', <IconVolumeOff className='size-4' />)}
          </Button>
        </IconButtonTooltip>
        <IconButtonTooltip label='Volume up'>
          <Button
            size='icon'
            variant='ghost'
            disabled={controlsDisabled}
            onClick={() => sendControl('volume-up')}
            aria-label='Volume up'
            className='size-8'
          >
            {controlIcon('volume-up', <IconVolume2 className='size-4' />)}
          </Button>
        </IconButtonTooltip>
      </div>

      <IconButtonTooltip label='Rotate display'>
        <Button
          size='icon'
          variant='secondary'
          disabled={controlsDisabled}
          onClick={() => sendControl('rotate')}
          aria-label='Rotate display'
        >
          {controlIcon('rotate', <IconDeviceMobileRotated className='size-4' />)}
        </Button>
      </IconButtonTooltip>

      <IconButtonTooltip label='Wake display'>
        <Button
          size='icon'
          variant='secondary'
          disabled={controlsDisabled}
          onClick={() => sendControl('wake')}
          aria-label='Wake display'
        >
          {controlIcon('wake', <IconPower className='size-4' />)}
        </Button>
      </IconButtonTooltip>

      <DropdownMenu>
        <Tooltip>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                size='icon'
                variant='secondary'
                disabled={controlsDisabled}
                aria-label='Android panels'
              >
                <IconBell className='size-4' />
              </Button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          <TooltipContent>Android panels</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align='center'>
          <DropdownMenuLabel>Panels</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => sendControl('expand-notifications')}>Notifications</DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendControl('expand-settings')}>Quick settings</DropdownMenuItem>
          <DropdownMenuItem onClick={() => sendControl('collapse-panels')}>Collapse panels</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size='sm'
        variant={hideOutline ? 'default' : 'secondary'}
        disabled={fullscreen}
        onClick={onToggleFrame}
      >
        {hideOutline ? 'Borderless' : 'Device frame'}
      </Button>
      <IconButtonTooltip label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
        <Button
          size='icon'
          variant={fullscreen ? 'default' : 'secondary'}
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className={cn({ 'bg-primary/80': fullscreen })}
        >
          {fullscreen ? <IconArrowsMinimize className='size-4' /> : <IconArrowsMaximize className='size-4' />}
        </Button>
      </IconButtonTooltip>
      <Visible when={!canControl && runtimeAvailable}>
        <div className='text-xs text-muted-foreground'>Viewer controls are disabled by permissions.</div>
      </Visible>
    </div>
  )
}
