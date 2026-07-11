'use client'

import type { ReactNode } from 'react'
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBell,
  IconExternalLink,
  IconKeyboard,
  IconLoader2,
  IconPhoto
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Visible } from '@/components/ui/visible'
import { panelControls } from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import { IconButtonTooltip } from '@/features/applications/viewer/display/viewer-control-bar/controls/icon-button-tooltip'
import { cn } from '@/lib/utils'
import type { SendControl } from '@/features/applications/viewer/display/viewer-control-bar/types'

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
      size='icon-md'
      variant={active ? 'primary' : 'secondary'}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={className}
    >
      {children}
    </Button>
  </IconButtonTooltip>
)

export const CaptureScreenshotButton = ({
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

export const KeyboardCaptureButton = ({
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

export const FullscreenButton = ({
  className,
  fullscreen,
  onToggleFullscreen
}: {
  className?: string
  fullscreen: boolean
  onToggleFullscreen?: () => void
}) => (
  <Visible when={Boolean(onToggleFullscreen)}>
    <ControlButton
      label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      onClick={onToggleFullscreen}
      className={className}
    >
      {fullscreen ? <IconArrowsMinimize className='size-4' /> : <IconArrowsMaximize className='size-4' />}
    </ControlButton>
  </Visible>
)

export const PopoutButton = ({ className, onOpenPopout }: { className?: string; onOpenPopout?: () => void }) => (
  <Visible when={Boolean(onOpenPopout)}>
    <ControlButton
      label='Open viewer in new window'
      onClick={onOpenPopout}
      className={className}
    >
      <IconExternalLink className='size-4' />
    </ControlButton>
  </Visible>
)

export const AndroidPanelsMenu = ({
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
            size='icon-md'
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
      <DropdownMenuGroup>
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
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
)
