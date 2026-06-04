'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { renderControlIcon } from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import { useViewerControlSender } from '@/features/applications/viewer/display/viewer-control-bar/commands/use-viewer-control-sender'
import { FloatingPrimaryControls } from '@/features/applications/viewer/display/viewer-control-bar/floating/floating-primary-controls'
import { FloatingViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/floating/floating-viewer-controls'
import { useFloatingToolbarDrag } from '@/features/applications/viewer/display/viewer-control-bar/floating/use-floating-toolbar-drag'
import { StandardViewerControls } from '@/features/applications/viewer/display/viewer-control-bar/standard/standard-viewer-controls'
import type { ApplicationViewerControlCommand } from '@/server/orchestrator/applications/types'

type ViewerControlBarProps = {
  appId: string
  surfaceId?: string
  runtimeAvailable: boolean
  canControl: boolean
  canCaptureScreenshot: boolean
  fullscreen: boolean
  isCapturing: boolean
  keyboardCaptureEnabled?: boolean
  surfaceActions?: ReactNode
  onCaptureScreenshot: () => void
  onOpenPopout?: () => void
  onToggleKeyboardCapture?: () => void
  onToggleFullscreen?: () => void
  onRotateViewer?: () => void
  mode?: 'bar' | 'floating'
}

export const ViewerControlBar = ({
  appId,
  surfaceId,
  runtimeAvailable,
  canControl,
  canCaptureScreenshot,
  fullscreen,
  isCapturing,
  keyboardCaptureEnabled = false,
  surfaceActions,
  onCaptureScreenshot,
  onOpenPopout,
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
    surfaceId,
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
            surfaceActions={surfaceActions}
            onCaptureScreenshot={onCaptureScreenshot}
            onOpenPopout={onOpenPopout}
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
      surfaceActions={surfaceActions}
      onCaptureScreenshot={onCaptureScreenshot}
      onOpenPopout={onOpenPopout}
      onToggleFullscreen={onToggleFullscreen}
      onToggleKeyboardCapture={onToggleKeyboardCapture}
    />
  )
}
