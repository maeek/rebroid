'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconGripVertical,
  IconHome,
  IconKeyboard,
  IconLayoutSidebarRight,
  IconLoader2,
  IconPhoto,
  IconPlayerTrackNext,
  IconPower,
  IconRotateClockwise2,
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
import { viewerControlCommandEventType } from './android'
import type { ApplicationViewerControlCommand } from '@/server/orchestrator/applications/types'

const controlErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : ''
  const lowerMessage = message.toLowerCase()
  if (
    !message ||
    lowerMessage.includes('sidecar') ||
    lowerMessage.includes('adb') ||
    lowerMessage.includes('nestjs') ||
    lowerMessage.includes('nextjs') ||
    lowerMessage.includes('next.js') ||
    lowerMessage.includes('fetch failed')
  ) {
    return 'The viewer could not send that command. Refresh the viewer or restart the app, then try again.'
  }

  return message
}

const IconButtonTooltip = ({ label, children }: { label: string; children: ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

const ControlButton = ({
  label,
  disabled,
  active = false,
  onClick,
  children,
  className
}: {
  label: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) => (
  <IconButtonTooltip label={label}>
    <Button
      size='icon'
      variant={active ? 'default' : 'secondary'}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={className}
    >
      {children}
    </Button>
  </IconButtonTooltip>
)

type ViewerControlBarProps = {
  appId: string
  runtimeAvailable: boolean
  canControl: boolean
  canCaptureScreenshot: boolean
  fullscreen: boolean
  isCapturing: boolean
  keyboardCaptureEnabled?: boolean
  onCaptureScreenshot: () => void
  onToggleKeyboardCapture?: () => void
  onToggleFullscreen: () => void
  onRotateViewer?: () => void
  mode?: 'bar' | 'floating'
}

export const ViewerControlBar = ({
  appId,
  runtimeAvailable,
  canControl,
  canCaptureScreenshot,
  fullscreen,
  isCapturing,
  keyboardCaptureEnabled = false,
  onCaptureScreenshot,
  onToggleKeyboardCapture,
  onToggleFullscreen,
  onRotateViewer,
  mode = 'bar'
}: ViewerControlBarProps) => {
  const [pendingCommand, setPendingCommand] = useState<ApplicationViewerControlCommand | null>(null)
  const [floatingOpen, setFloatingOpen] = useState(false)
  const [floatingCollapsed, setFloatingCollapsed] = useState(false)
  const [floatingPosition, setFloatingPosition] = useState({ x: 16, y: 96 })
  const [isPending, startTransition] = useTransition()
  const localPendingTimer = useRef<number | null>(null)
  const floatingDragCleanup = useRef<(() => void) | null>(null)
  const dragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const controlsDisabled = !runtimeAvailable || !canControl || isPending

  useEffect(() => {
    return () => {
      if (localPendingTimer.current !== null) {
        window.clearTimeout(localPendingTimer.current)
      }
      floatingDragCleanup.current?.()
    }
  }, [])

  const updateFloatingPosition = (nextX: number, nextY: number) => {
    const maxX = typeof window === 'undefined' ? nextX : window.innerWidth - 72
    const maxY = typeof window === 'undefined' ? nextY : window.innerHeight - 72

    setFloatingPosition({
      x: Math.min(Math.max(8, nextX), Math.max(8, maxX)),
      y: Math.min(Math.max(8, nextY), Math.max(8, maxY))
    })
  }

  const handleFloatingPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    floatingDragCleanup.current?.()
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: floatingPosition.x,
      originY: floatingPosition.y
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some mobile browsers do not retain capture when the dragged element moves.
    }

    const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
      const state = dragState.current
      if (!state || state.pointerId !== moveEvent.pointerId) {
        return
      }

      moveEvent.preventDefault()
      updateFloatingPosition(
        state.originX + moveEvent.clientX - state.startX,
        state.originY + moveEvent.clientY - state.startY
      )
    }

    const finishWindowDrag = (upEvent: globalThis.PointerEvent) => {
      const state = dragState.current
      if (!state || state.pointerId !== upEvent.pointerId) {
        return
      }

      upEvent.preventDefault()
      dragState.current = null
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', finishWindowDrag)
      window.removeEventListener('pointercancel', finishWindowDrag)
      floatingDragCleanup.current = null
    }

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
    window.addEventListener('pointerup', finishWindowDrag, { passive: false })
    window.addEventListener('pointercancel', finishWindowDrag, { passive: false })
    floatingDragCleanup.current = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove)
      window.removeEventListener('pointerup', finishWindowDrag)
      window.removeEventListener('pointercancel', finishWindowDrag)
      floatingDragCleanup.current = null
    }
  }

  const handleFloatingPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current
    if (!state || state.pointerId !== event.pointerId) {
      return
    }

    updateFloatingPosition(state.originX + event.clientX - state.startX, state.originY + event.clientY - state.startY)
  }

  const handleFloatingPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = dragState.current
    if (!state || state.pointerId !== event.pointerId) {
      return
    }

    dragState.current = null
    floatingDragCleanup.current?.()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be gone on mobile browsers.
    }
  }

  const sendControl = (command: ApplicationViewerControlCommand) => {
    if (controlsDisabled) {
      return
    }

    setPendingCommand(command)
    if (typeof window !== 'undefined') {
      const locallyHandled = !window.dispatchEvent(
        new CustomEvent(viewerControlCommandEventType, {
          cancelable: true,
          detail: { command }
        })
      )

      if (locallyHandled) {
        if (command === 'rotate') {
          onRotateViewer?.()
        }
        if (localPendingTimer.current !== null) {
          window.clearTimeout(localPendingTimer.current)
        }
        localPendingTimer.current = window.setTimeout(() => {
          setPendingCommand(null)
          localPendingTimer.current = null
        }, 160)
        return
      }
    }

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

  const controls = (
    <>
      <Visible when={runtimeAvailable && canCaptureScreenshot}>
        <ControlButton
          label='Capture screenshot'
          disabled={isCapturing}
          onClick={onCaptureScreenshot}
        >
          {isCapturing ? <IconLoader2 className='size-4 animate-spin' /> : <IconPhoto className='size-4' />}
        </ControlButton>
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

      <ControlButton
        label='Auto-rotate display'
        disabled={controlsDisabled}
        onClick={() => sendControl('rotate')}
      >
        {controlIcon('rotate', <IconRotateClockwise2 className='size-4' />)}
      </ControlButton>

      <Visible when={mode !== 'floating'}>
        <ControlButton
          label={keyboardCaptureEnabled ? 'Disable keyboard capture' : 'Enable keyboard capture'}
          active={keyboardCaptureEnabled}
          disabled={controlsDisabled}
          onClick={onToggleKeyboardCapture}
          className={cn({ 'bg-primary/80': keyboardCaptureEnabled })}
        >
          <IconKeyboard className='size-4' />
        </ControlButton>
      </Visible>

      <ControlButton
        label='Wake display'
        disabled={controlsDisabled}
        onClick={() => sendControl('wake')}
      >
        {controlIcon('wake', <IconPower className='size-4' />)}
      </ControlButton>

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

      <Visible when={mode !== 'floating'}>
        <IconButtonTooltip label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <Button
            size='icon'
            variant='secondary'
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {fullscreen ? <IconArrowsMinimize className='size-4' /> : <IconArrowsMaximize className='size-4' />}
          </Button>
        </IconButtonTooltip>
      </Visible>
      <Visible when={!canControl && runtimeAvailable}>
        <div className='text-xs text-muted-foreground'>Viewer controls are disabled by permissions.</div>
      </Visible>
    </>
  )

  const floatingPrimaryControls = (
    <>
      <Visible when={runtimeAvailable && canCaptureScreenshot}>
        <ControlButton
          label='Capture screenshot'
          disabled={isCapturing}
          onClick={onCaptureScreenshot}
          className='size-9'
        >
          {isCapturing ? <IconLoader2 className='size-4 animate-spin' /> : <IconPhoto className='size-4' />}
        </ControlButton>
      </Visible>
      <ControlButton
        label='Volume down'
        disabled={controlsDisabled}
        onClick={() => sendControl('volume-down')}
        className='size-9'
      >
        {controlIcon('volume-down', <IconVolume className='size-4' />)}
      </ControlButton>
      <ControlButton
        label='Mute device'
        disabled={controlsDisabled}
        onClick={() => sendControl('mute')}
        className='size-9'
      >
        {controlIcon('mute', <IconVolumeOff className='size-4' />)}
      </ControlButton>
      <ControlButton
        label='Volume up'
        disabled={controlsDisabled}
        onClick={() => sendControl('volume-up')}
        className='size-9'
      >
        {controlIcon('volume-up', <IconVolume2 className='size-4' />)}
      </ControlButton>
      <ControlButton
        label='Auto-rotate display'
        disabled={controlsDisabled}
        onClick={() => sendControl('rotate')}
        className='size-9'
      >
        {controlIcon('rotate', <IconRotateClockwise2 className='size-4' />)}
      </ControlButton>
      <ControlButton
        label='Wake display'
        disabled={controlsDisabled}
        onClick={() => sendControl('wake')}
        className='size-9'
      >
        {controlIcon('wake', <IconPower className='size-4' />)}
      </ControlButton>
      <ControlButton
        label={keyboardCaptureEnabled ? 'Disable keyboard capture' : 'Enable keyboard capture'}
        active={keyboardCaptureEnabled}
        disabled={controlsDisabled}
        onClick={onToggleKeyboardCapture}
        className={cn('size-9', { 'bg-primary/80': keyboardCaptureEnabled })}
      >
        <IconKeyboard className='size-4' />
      </ControlButton>
      <DropdownMenu>
        <Tooltip>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                size='icon'
                variant='secondary'
                disabled={controlsDisabled}
                aria-label='Android panels'
                className='size-9'
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
      <ControlButton
        label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        onClick={onToggleFullscreen}
        className='size-9'
      >
        {fullscreen ? <IconArrowsMinimize className='size-4' /> : <IconArrowsMaximize className='size-4' />}
      </ControlButton>
    </>
  )

  if (mode === 'floating') {
    const collapseTowardLeft = floatingPosition.x < 160

    if (floatingCollapsed) {
      return (
        <div
          className='absolute z-30'
          style={{ left: floatingPosition.x, top: floatingPosition.y }}
        >
          <div className='flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/90 p-1 shadow-2xl backdrop-blur-xl'>
            <button
              type='button'
              className='flex size-9 touch-none select-none items-center justify-center rounded-lg text-secondary-foreground hover:bg-secondary active:cursor-grabbing'
              aria-label='Move viewer toolbar'
              onPointerDown={handleFloatingPointerDown}
              onPointerMove={handleFloatingPointerMove}
              onPointerUp={handleFloatingPointerUp}
              onPointerCancel={handleFloatingPointerUp}
            >
              <IconGripVertical className='size-4' />
            </button>
            <IconButtonTooltip label='Show toolbar'>
              <Button
                size='icon'
                variant='secondary'
                onClick={() => setFloatingCollapsed(false)}
                aria-label='Show toolbar'
                className='size-9'
              >
                {collapseTowardLeft ? <IconChevronRight className='size-4' /> : <IconChevronLeft className='size-4' />}
              </Button>
            </IconButtonTooltip>
          </div>
        </div>
      )
    }

    return (
      <div
        className='absolute z-30'
        style={{ left: floatingPosition.x, top: floatingPosition.y }}
      >
        <div className='flex max-h-[calc(100dvh-1rem)] flex-col items-center gap-1 overflow-y-auto rounded-xl border border-border/70 bg-card/90 p-1 shadow-2xl backdrop-blur-xl'>
          <button
            type='button'
            className='flex size-9 touch-none select-none items-center justify-center rounded-lg text-secondary-foreground hover:bg-secondary active:cursor-grabbing'
            aria-label='Move viewer toolbar'
            onPointerDown={handleFloatingPointerDown}
            onPointerMove={handleFloatingPointerMove}
            onPointerUp={handleFloatingPointerUp}
            onPointerCancel={handleFloatingPointerUp}
          >
            <IconGripVertical className='size-4' />
          </button>
          <IconButtonTooltip label='Hide toolbar'>
            <Button
              size='icon'
              variant='ghost'
              onClick={() => setFloatingCollapsed(true)}
              aria-label='Hide toolbar'
              className='size-9'
            >
              {collapseTowardLeft ? <IconChevronLeft className='size-4' /> : <IconChevronRight className='size-4' />}
            </Button>
          </IconButtonTooltip>
          {floatingPrimaryControls}
          <Button
            size='icon'
            variant={floatingOpen ? 'default' : 'secondary'}
            onClick={() => setFloatingOpen(current => !current)}
            aria-label='Navigation controls'
            className='size-9'
          >
            <IconLayoutSidebarRight className='size-4' />
          </Button>
          <Visible when={floatingOpen}>
            <div className='mt-1 flex flex-col items-center gap-1 border-t border-border/60 pt-1'>
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
          </Visible>
        </div>
      </div>
    )
  }

  return <div className='flex w-full flex-wrap items-center justify-center gap-2 pb-2'>{controls}</div>
}
