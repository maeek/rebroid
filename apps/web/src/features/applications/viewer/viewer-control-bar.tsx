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
import { sendApplicationViewerControlAction } from '@/server/orchestrator/applications/actions/runtime/viewer-actions'
import { viewerControlCommandEventType } from './android'
import type { ApplicationViewerControlCommand } from '@/server/orchestrator/applications/types'

const controlErrorDescription = (error: unknown) => {
  const message = error instanceof Error ? error.message.trim() : ''
  const lowerMessage = message.toLowerCase()
  const genericErrorTerms = ['sidecar', 'adb', 'nestjs', 'nextjs', 'next.js', 'fetch failed']

  if (!message || genericErrorTerms.some(term => lowerMessage.includes(term))) {
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

type SendControl = (command: ApplicationViewerControlCommand) => void
type ControlIconRenderer = (command: ApplicationViewerControlCommand, icon: ReactNode) => ReactNode
type FloatingPosition = { x: number; y: number }
type IconControl = {
  command: ApplicationViewerControlCommand
  label: string
  icon: ReactNode
}
type DragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

const navigationControls: IconControl[] = [
  {
    command: 'back',
    label: 'Back',
    icon: <IconPlayerTrackNext className='size-4 rotate-180' />
  },
  {
    command: 'home',
    label: 'Home',
    icon: <IconHome className='size-4' />
  },
  {
    command: 'recents',
    label: 'Recent apps',
    icon: <IconLayoutSidebarRight className='size-4' />
  }
]

const panelControls: Array<{
  command: ApplicationViewerControlCommand
  label: string
}> = [
  { command: 'expand-notifications', label: 'Notifications' },
  { command: 'expand-settings', label: 'Quick settings' },
  { command: 'collapse-panels', label: 'Collapse panels' }
]

const volumeControls: IconControl[] = [
  {
    command: 'volume-down',
    label: 'Volume down',
    icon: <IconVolume className='size-4' />
  },
  {
    command: 'mute',
    label: 'Mute device',
    icon: <IconVolumeOff className='size-4' />
  },
  {
    command: 'volume-up',
    label: 'Volume up',
    icon: <IconVolume2 className='size-4' />
  }
]

const displayControls: IconControl[] = [
  {
    command: 'rotate',
    label: 'Auto-rotate display',
    icon: <IconRotateClockwise2 className='size-4' />
  },
  {
    command: 'wake',
    label: 'Wake display',
    icon: <IconPower className='size-4' />
  }
]

const IconCommandGroup = ({
  buttonClassName = 'size-8',
  buttonVariant = 'ghost',
  className,
  controls,
  controlsDisabled,
  controlIcon,
  sendControl
}: {
  buttonClassName?: string
  buttonVariant?: 'ghost' | 'secondary'
  className: string
  controls: IconControl[]
  controlsDisabled: boolean
  controlIcon: ControlIconRenderer
  sendControl: SendControl
}) => (
  <div className={className}>
    {controls.map(({ command, label, icon }) => (
      <IconButtonTooltip
        key={command}
        label={label}
      >
        <Button
          size='icon'
          variant={buttonVariant}
          disabled={controlsDisabled}
          onClick={() => sendControl(command)}
          aria-label={label}
          className={buttonClassName}
        >
          {controlIcon(command, icon)}
        </Button>
      </IconButtonTooltip>
    ))}
  </div>
)

const CaptureScreenshotButton = ({
  className,
  isCapturing,
  onCaptureScreenshot
}: {
  className?: string
  isCapturing: boolean
  onCaptureScreenshot: () => void
}) => (
  <ControlButton
    label='Capture screenshot'
    disabled={isCapturing}
    onClick={onCaptureScreenshot}
    className={className}
  >
    {isCapturing ? <IconLoader2 className='size-4 animate-spin' /> : <IconPhoto className='size-4' />}
  </ControlButton>
)

const KeyboardCaptureButton = ({
  className,
  controlsDisabled,
  keyboardCaptureEnabled,
  onToggleKeyboardCapture
}: {
  className?: string
  controlsDisabled: boolean
  keyboardCaptureEnabled: boolean
  onToggleKeyboardCapture?: () => void
}) => (
  <ControlButton
    label={keyboardCaptureEnabled ? 'Disable keyboard capture' : 'Enable keyboard capture'}
    active={keyboardCaptureEnabled}
    disabled={controlsDisabled}
    onClick={onToggleKeyboardCapture}
    className={cn(className, { 'bg-primary/80': keyboardCaptureEnabled })}
  >
    <IconKeyboard className='size-4' />
  </ControlButton>
)

const FullscreenButton = ({
  className,
  fullscreen,
  onToggleFullscreen
}: {
  className?: string
  fullscreen: boolean
  onToggleFullscreen: () => void
}) => (
  <ControlButton
    label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    onClick={onToggleFullscreen}
    className={className}
  >
    {fullscreen ? <IconArrowsMinimize className='size-4' /> : <IconArrowsMaximize className='size-4' />}
  </ControlButton>
)

const AndroidPanelsMenu = ({
  buttonClassName,
  controlsDisabled,
  sendControl
}: {
  buttonClassName?: string
  controlsDisabled: boolean
  sendControl: SendControl
}) => (
  <DropdownMenu>
    <Tooltip>
      <DropdownMenuTrigger asChild>
        <TooltipTrigger asChild>
          <Button
            size='icon'
            variant='secondary'
            disabled={controlsDisabled}
            aria-label='Android panels'
            className={buttonClassName}
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
      {panelControls.map(({ command, label }) => (
        <DropdownMenuItem
          key={command}
          onClick={() => sendControl(command)}
        >
          {label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)

const FloatingToolbarHandle = ({
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu
}: {
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onContextMenu: (event: { preventDefault: () => void }) => void
}) => (
  <button
    type='button'
    className='flex size-9 touch-none select-none items-center justify-center rounded-lg text-secondary-foreground hover:bg-secondary active:cursor-grabbing'
    aria-label='Move viewer toolbar'
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    onContextMenu={onContextMenu}
  >
    <IconGripVertical className='size-4' />
  </button>
)

const FloatingToolbarToggle = ({
  label,
  variant,
  collapseTowardLeft,
  isCollapsing,
  onClick
}: {
  label: string
  variant: 'ghost' | 'secondary'
  collapseTowardLeft: boolean
  isCollapsing: boolean
  onClick: () => void
}) => {
  const Icon = collapseTowardLeft === isCollapsing ? IconChevronLeft : IconChevronRight

  return (
    <IconButtonTooltip label={label}>
      <Button
        size='icon'
        variant={variant}
        onClick={onClick}
        aria-label={label}
        className='size-9'
      >
        <Icon className='size-4' />
      </Button>
    </IconButtonTooltip>
  )
}

const clampFloatingPosition = (nextX: number, nextY: number): FloatingPosition => {
  const maxX = typeof window === 'undefined' ? nextX : window.innerWidth - 72
  const maxY = typeof window === 'undefined' ? nextY : window.innerHeight - 72

  return {
    x: Math.min(Math.max(8, nextX), Math.max(8, maxX)),
    y: Math.min(Math.max(8, nextY), Math.max(8, maxY))
  }
}

const getDraggedPosition = (state: DragState, clientX: number, clientY: number) =>
  clampFloatingPosition(state.originX + clientX - state.startX, state.originY + clientY - state.startY)

const clearLocalPendingTimer = (timerRef: { current: number | null }) => {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

const dispatchLocalViewerCommand = (command: ApplicationViewerControlCommand) => {
  if (typeof window === 'undefined') {
    return false
  }

  return !window.dispatchEvent(
    new CustomEvent(viewerControlCommandEventType, {
      cancelable: true,
      detail: { command }
    })
  )
}

const runRotateSideEffect = (command: ApplicationViewerControlCommand, onRotateViewer?: () => void) => {
  if (command === 'rotate') {
    onRotateViewer?.()
  }
}

const getMatchingDragState = (dragState: { current: DragState | null }, pointerId: number) => {
  const state = dragState.current
  return state?.pointerId === pointerId ? state : null
}

const releasePointerCapture = (event: PointerEvent<HTMLButtonElement>) => {
  try {
    event.currentTarget.releasePointerCapture(event.pointerId)
  } catch {
    // Pointer capture may already be gone on mobile browsers.
  }
}

const capturePointer = (event: PointerEvent<HTMLButtonElement>) => {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // Some mobile browsers do not retain capture when the dragged element moves.
  }
}

const createFloatingDragCleanup =
  (
    handleWindowPointerMove: (event: globalThis.PointerEvent) => void,
    finishWindowDrag: (event: globalThis.PointerEvent) => void,
    cleanupRef: { current: (() => void) | null }
  ) =>
  () => {
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', finishWindowDrag)
    window.removeEventListener('pointercancel', finishWindowDrag)
    cleanupRef.current = null
  }

const clearFloatingDragCleanup = (cleanupRef: { current: (() => void) | null }) => {
  cleanupRef.current?.()
}

const registerFloatingWindowDrag = ({
  cleanupRef,
  dragState,
  setFloatingPosition
}: {
  cleanupRef: { current: (() => void) | null }
  dragState: { current: DragState | null }
  setFloatingPosition: (position: FloatingPosition) => void
}) => {
  const handleWindowPointerMove = (moveEvent: globalThis.PointerEvent) => {
    const state = getMatchingDragState(dragState, moveEvent.pointerId)
    if (!state) {
      return
    }

    moveEvent.preventDefault()
    setFloatingPosition(getDraggedPosition(state, moveEvent.clientX, moveEvent.clientY))
  }

  const finishWindowDrag = (upEvent: globalThis.PointerEvent) => {
    const state = getMatchingDragState(dragState, upEvent.pointerId)
    if (!state) {
      return
    }

    upEvent.preventDefault()
    dragState.current = null
    cleanupRef.current?.()
  }

  window.addEventListener('pointermove', handleWindowPointerMove, { passive: false })
  window.addEventListener('pointerup', finishWindowDrag, { passive: false })
  window.addEventListener('pointercancel', finishWindowDrag, { passive: false })
  cleanupRef.current = createFloatingDragCleanup(handleWindowPointerMove, finishWindowDrag, cleanupRef)
}

const useViewerControlSender = ({
  appId,
  baseControlsDisabled,
  onRotateViewer
}: {
  appId: string
  baseControlsDisabled: boolean
  onRotateViewer?: () => void
}) => {
  const [pendingCommand, setPendingCommand] = useState<ApplicationViewerControlCommand | null>(null)
  const [isPending, startTransition] = useTransition()
  const localPendingTimer = useRef<number | null>(null)
  const controlsDisabled = baseControlsDisabled || isPending

  useEffect(() => {
    return () => clearLocalPendingTimer(localPendingTimer)
  }, [])

  const sendControl = (command: ApplicationViewerControlCommand) => {
    if (controlsDisabled) {
      return
    }

    setPendingCommand(command)

    if (dispatchLocalViewerCommand(command)) {
      runRotateSideEffect(command, onRotateViewer)
      clearLocalPendingTimer(localPendingTimer)
      localPendingTimer.current = window.setTimeout(() => setPendingCommand(null), 160)
      return
    }

    startTransition(async () => {
      try {
        await sendApplicationViewerControlAction(appId, command)
        runRotateSideEffect(command, onRotateViewer)
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

  return { controlsDisabled, pendingCommand, sendControl }
}

const useFloatingToolbarDrag = (
  floatingPosition: FloatingPosition,
  setFloatingPosition: (position: FloatingPosition) => void
) => {
  const floatingDragCleanup = useRef<(() => void) | null>(null)
  const dragState = useRef<DragState | null>(null)

  useEffect(() => {
    return () => clearFloatingDragCleanup(floatingDragCleanup)
  }, [])

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

    capturePointer(event)
    registerFloatingWindowDrag({ cleanupRef: floatingDragCleanup, dragState, setFloatingPosition })
  }

  const handleFloatingPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = getMatchingDragState(dragState, event.pointerId)
    if (!state) {
      return
    }

    setFloatingPosition(getDraggedPosition(state, event.clientX, event.clientY))
  }

  const handleFloatingPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const state = getMatchingDragState(dragState, event.pointerId)
    if (!state) {
      return
    }

    dragState.current = null
    floatingDragCleanup.current?.()
    releasePointerCapture(event)
  }

  return {
    handleFloatingPointerDown,
    handleFloatingPointerMove,
    handleFloatingPointerUp
  }
}

const renderControlIcon = (
  pendingCommand: ApplicationViewerControlCommand | null,
  command: ApplicationViewerControlCommand,
  icon: ReactNode
) => (pendingCommand === command ? <IconLoader2 className='size-4 animate-spin' /> : icon)

type ViewerControlRenderProps = {
  canCaptureScreenshot: boolean
  canControl: boolean
  controlsDisabled: boolean
  controlIcon: ControlIconRenderer
  fullscreen: boolean
  isCapturing: boolean
  keyboardCaptureEnabled: boolean
  runtimeAvailable: boolean
  sendControl: SendControl
  onCaptureScreenshot: () => void
  onToggleFullscreen: () => void
  onToggleKeyboardCapture?: () => void
}

const StandardViewerControls = ({
  canCaptureScreenshot,
  canControl,
  controlsDisabled,
  controlIcon,
  fullscreen,
  isCapturing,
  keyboardCaptureEnabled,
  runtimeAvailable,
  sendControl,
  onCaptureScreenshot,
  onToggleFullscreen,
  onToggleKeyboardCapture
}: ViewerControlRenderProps) => (
  <div className='flex w-full flex-wrap items-center justify-center gap-2 pb-2 z-50'>
    <IconCommandGroup
      className='flex items-center rounded-md border border-border/60 bg-secondary/35 p-1'
      controls={navigationControls}
      controlsDisabled={controlsDisabled}
      controlIcon={controlIcon}
      sendControl={sendControl}
    />
    <IconCommandGroup
      className='flex items-center rounded-md border border-border/60 bg-secondary/35 p-1'
      controls={volumeControls}
      controlsDisabled={controlsDisabled}
      controlIcon={controlIcon}
      sendControl={sendControl}
    />
    <IconCommandGroup
      buttonVariant='secondary'
      className='contents'
      controls={displayControls}
      controlsDisabled={controlsDisabled}
      controlIcon={controlIcon}
      sendControl={sendControl}
    />
    <KeyboardCaptureButton
      controlsDisabled={controlsDisabled}
      keyboardCaptureEnabled={keyboardCaptureEnabled}
      onToggleKeyboardCapture={onToggleKeyboardCapture}
    />
    <AndroidPanelsMenu
      controlsDisabled={controlsDisabled}
      sendControl={sendControl}
    />
    <Visible when={runtimeAvailable && canCaptureScreenshot}>
      <CaptureScreenshotButton
        isCapturing={isCapturing}
        onCaptureScreenshot={onCaptureScreenshot}
      />
    </Visible>
    <FullscreenButton
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
    <Visible when={!canControl && runtimeAvailable}>
      <div className='text-xs text-muted-foreground'>Viewer controls are disabled by permissions.</div>
    </Visible>
  </div>
)

const FloatingPrimaryControls = ({
  canCaptureScreenshot,
  controlsDisabled,
  controlIcon,
  fullscreen,
  isCapturing,
  keyboardCaptureEnabled,
  runtimeAvailable,
  sendControl,
  onCaptureScreenshot,
  onToggleFullscreen,
  onToggleKeyboardCapture
}: Omit<ViewerControlRenderProps, 'canControl'>) => (
  <>
    <Visible when={runtimeAvailable && canCaptureScreenshot}>
      <CaptureScreenshotButton
        className='size-9'
        isCapturing={isCapturing}
        onCaptureScreenshot={onCaptureScreenshot}
      />
    </Visible>
    <IconCommandGroup
      buttonClassName='size-9'
      buttonVariant='secondary'
      className='contents'
      controls={volumeControls}
      controlsDisabled={controlsDisabled}
      controlIcon={controlIcon}
      sendControl={sendControl}
    />
    <IconCommandGroup
      buttonClassName='size-9'
      buttonVariant='secondary'
      className='contents'
      controls={displayControls}
      controlsDisabled={controlsDisabled}
      controlIcon={controlIcon}
      sendControl={sendControl}
    />
    <KeyboardCaptureButton
      className='size-9'
      controlsDisabled={controlsDisabled}
      keyboardCaptureEnabled={keyboardCaptureEnabled}
      onToggleKeyboardCapture={onToggleKeyboardCapture}
    />
    <AndroidPanelsMenu
      buttonClassName='size-9'
      controlsDisabled={controlsDisabled}
      sendControl={sendControl}
    />
    <FullscreenButton
      className='size-9'
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
  </>
)

type FloatingViewerControlsProps = {
  collapsed: boolean
  controlIcon: ControlIconRenderer
  controlsDisabled: boolean
  floatingOpen: boolean
  position: FloatingPosition
  renderPrimaryControls: ReactNode
  sendControl: SendControl
  setCollapsed: (collapsed: boolean) => void
  setFloatingOpen: (open: (current: boolean) => boolean) => void
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
}

type FloatingToolbarRenderProps = Pick<
  FloatingViewerControlsProps,
  | 'controlIcon'
  | 'controlsDisabled'
  | 'floatingOpen'
  | 'position'
  | 'renderPrimaryControls'
  | 'sendControl'
  | 'setCollapsed'
  | 'setFloatingOpen'
>

const FloatingToolbarShell = ({
  expanded = false,
  position,
  preventContextMenu,
  children
}: {
  expanded?: boolean
  position: FloatingPosition
  preventContextMenu: (event: { preventDefault: () => void }) => void
  children: ReactNode
}) => (
  <div
    className='absolute z-30'
    style={{ left: position.x, top: position.y }}
    onContextMenu={preventContextMenu}
  >
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/90 p-1 shadow-2xl backdrop-blur-xl',
        expanded && 'max-h-[calc(100dvh-1rem)] overflow-y-auto'
      )}
    >
      {children}
    </div>
  </div>
)

const FloatingNavigationToggle = ({
  floatingOpen,
  setFloatingOpen
}: {
  floatingOpen: boolean
  setFloatingOpen: (open: (current: boolean) => boolean) => void
}) => (
  <Button
    size='icon'
    variant={floatingOpen ? 'default' : 'secondary'}
    onClick={() => setFloatingOpen(current => !current)}
    aria-label='Navigation controls'
    className='size-9'
  >
    <IconLayoutSidebarRight className='size-4' />
  </Button>
)

const CollapsedFloatingViewerControls = ({
  collapseTowardLeft,
  handle,
  position,
  preventContextMenu,
  setCollapsed
}: Pick<FloatingToolbarRenderProps, 'position' | 'setCollapsed'> & {
  collapseTowardLeft: boolean
  handle: ReactNode
  preventContextMenu: (event: { preventDefault: () => void }) => void
}) => (
  <FloatingToolbarShell
    position={position}
    preventContextMenu={preventContextMenu}
  >
    {handle}
    <FloatingToolbarToggle
      label='Show toolbar'
      variant='secondary'
      collapseTowardLeft={collapseTowardLeft}
      isCollapsing={false}
      onClick={() => setCollapsed(false)}
    />
  </FloatingToolbarShell>
)

const ExpandedFloatingViewerControls = ({
  collapseTowardLeft,
  controlIcon,
  controlsDisabled,
  floatingOpen,
  handle,
  position,
  preventContextMenu,
  renderPrimaryControls,
  sendControl,
  setCollapsed,
  setFloatingOpen
}: FloatingToolbarRenderProps & {
  collapseTowardLeft: boolean
  handle: ReactNode
  preventContextMenu: (event: { preventDefault: () => void }) => void
}) => (
  <FloatingToolbarShell
    expanded
    position={position}
    preventContextMenu={preventContextMenu}
  >
    {handle}
    <FloatingToolbarToggle
      label='Hide toolbar'
      variant='ghost'
      collapseTowardLeft={collapseTowardLeft}
      isCollapsing
      onClick={() => setCollapsed(true)}
    />
    {renderPrimaryControls}
    <FloatingNavigationToggle
      floatingOpen={floatingOpen}
      setFloatingOpen={setFloatingOpen}
    />
    <Visible when={floatingOpen}>
      <IconCommandGroup
        className='mt-1 flex flex-col items-center gap-1 border-t border-border/60 pt-1'
        controls={navigationControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
    </Visible>
  </FloatingToolbarShell>
)

const FloatingViewerControls = ({
  collapsed,
  controlIcon,
  controlsDisabled,
  floatingOpen,
  position,
  renderPrimaryControls,
  sendControl,
  setCollapsed,
  setFloatingOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: FloatingViewerControlsProps) => {
  const collapseTowardLeft = position.x < 160
  const preventContextMenu = (event: { preventDefault: () => void }) => event.preventDefault()
  const handle = (
    <FloatingToolbarHandle
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={preventContextMenu}
    />
  )

  if (collapsed) {
    return (
      <CollapsedFloatingViewerControls
        collapseTowardLeft={collapseTowardLeft}
        handle={handle}
        position={position}
        preventContextMenu={preventContextMenu}
        setCollapsed={setCollapsed}
      />
    )
  }

  return (
    <ExpandedFloatingViewerControls
      collapseTowardLeft={collapseTowardLeft}
      controlIcon={controlIcon}
      controlsDisabled={controlsDisabled}
      floatingOpen={floatingOpen}
      handle={handle}
      position={position}
      preventContextMenu={preventContextMenu}
      renderPrimaryControls={renderPrimaryControls}
      sendControl={sendControl}
      setCollapsed={setCollapsed}
      setFloatingOpen={setFloatingOpen}
    />
  )
}

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
  const [floatingOpen, setFloatingOpen] = useState(false)
  const [floatingCollapsed, setFloatingCollapsed] = useState(false)
  const [floatingPosition, setFloatingPosition] = useState({ x: 16, y: 96 })
  const { controlsDisabled, pendingCommand, sendControl } = useViewerControlSender({
    appId,
    baseControlsDisabled: !runtimeAvailable || !canControl,
    onRotateViewer
  })
  const { handleFloatingPointerDown, handleFloatingPointerMove, handleFloatingPointerUp } = useFloatingToolbarDrag(
    floatingPosition,
    setFloatingPosition
  )

  const controlIcon = (command: ApplicationViewerControlCommand, icon: ReactNode) =>
    renderControlIcon(pendingCommand, command, icon)

  if (mode === 'floating') {
    return (
      <FloatingViewerControls
        collapsed={floatingCollapsed}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        floatingOpen={floatingOpen}
        position={floatingPosition}
        renderPrimaryControls={
          <FloatingPrimaryControls
            canCaptureScreenshot={canCaptureScreenshot}
            controlsDisabled={controlsDisabled}
            controlIcon={controlIcon}
            fullscreen={fullscreen}
            isCapturing={isCapturing}
            keyboardCaptureEnabled={keyboardCaptureEnabled}
            runtimeAvailable={runtimeAvailable}
            sendControl={sendControl}
            onCaptureScreenshot={onCaptureScreenshot}
            onToggleFullscreen={onToggleFullscreen}
            onToggleKeyboardCapture={onToggleKeyboardCapture}
          />
        }
        sendControl={sendControl}
        setCollapsed={setFloatingCollapsed}
        setFloatingOpen={setFloatingOpen}
        onPointerDown={handleFloatingPointerDown}
        onPointerMove={handleFloatingPointerMove}
        onPointerUp={handleFloatingPointerUp}
      />
    )
  }

  return (
    <StandardViewerControls
      canCaptureScreenshot={canCaptureScreenshot}
      canControl={canControl}
      controlsDisabled={controlsDisabled}
      controlIcon={controlIcon}
      fullscreen={fullscreen}
      isCapturing={isCapturing}
      keyboardCaptureEnabled={keyboardCaptureEnabled}
      runtimeAvailable={runtimeAvailable}
      sendControl={sendControl}
      onCaptureScreenshot={onCaptureScreenshot}
      onToggleFullscreen={onToggleFullscreen}
      onToggleKeyboardCapture={onToggleKeyboardCapture}
    />
  )
}
