import type { PointerEvent, ReactNode } from 'react'
import type { ApplicationViewerControlCommand } from '@/shared/contracts/application'

export type SendControl = (command: ApplicationViewerControlCommand) => void

export type ControlIconRenderer = (command: ApplicationViewerControlCommand, icon: ReactNode) => ReactNode

export type FloatingPosition = { x: number; y: number }

export type IconControl = {
  command: ApplicationViewerControlCommand
  label: string
  icon: ReactNode
}

export type DragState = {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

export type ViewerControlRenderProps = {
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
  onOpenPopout?: () => void
  onToggleFullscreen?: () => void
  onToggleKeyboardCapture?: () => void
}

export type FloatingViewerControlsProps = {
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

export type FloatingToolbarRenderProps = Pick<
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
