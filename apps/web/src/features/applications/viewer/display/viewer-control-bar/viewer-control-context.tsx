'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useDisplayViewerControls } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { renderControlIcon } from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import { useViewerControlSender } from '@/features/applications/viewer/display/viewer-control-bar/commands/use-viewer-control-sender'
import type {
  ControlCommandState,
  ControlIconRenderer,
  SendControl
} from '@/features/applications/viewer/display/viewer-control-bar/types'

type ViewerControlContextValue = {
  canCaptureScreenshot: boolean
  canControl: boolean
  controlsDisabled: boolean
  commandDisabled: ControlCommandState
  isCommandPending: ControlCommandState
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

const ViewerControlContext = createContext<ViewerControlContextValue | null>(null)

export const ViewerControlProvider = ({ children }: { children: ReactNode }) => {
  const controls = useDisplayViewerControls()
  const controlsDisabled = !controls.runtimeAvailable || !controls.canControl
  const { commandDisabled, isCommandPending, sendControl } = useViewerControlSender({
    appId: controls.appId,
    baseControlsDisabled: controlsDisabled || controls.streamBlocked,
    surfaceId: controls.surfaceId,
    frameKey: controls.frameKey
  })
  const controlIcon: ControlIconRenderer = (command, icon) => renderControlIcon(isCommandPending(command), icon)

  return (
    <ViewerControlContext.Provider
      value={{
        canCaptureScreenshot: controls.canCaptureScreenshot,
        canControl: controls.canControl,
        controlsDisabled,
        commandDisabled,
        isCommandPending,
        controlIcon,
        fullscreen: controls.fullscreen,
        isCapturing: controls.isCapturing,
        keyboardCaptureEnabled: controls.keyboardCaptureEnabled,
        runtimeAvailable: controls.runtimeAvailable,
        sendControl,
        onCaptureScreenshot: controls.onCaptureScreenshot,
        onOpenPopout: controls.onOpenPopout,
        onToggleFullscreen: controls.onToggleFullscreen,
        onToggleKeyboardCapture: controls.onToggleKeyboardCapture
      }}
    >
      {children}
    </ViewerControlContext.Provider>
  )
}

export const useViewerControlContext = () => {
  const context = useContext(ViewerControlContext)

  if (!context) {
    throw new Error('useViewerControlContext must be used within ViewerControlProvider')
  }

  return context
}
