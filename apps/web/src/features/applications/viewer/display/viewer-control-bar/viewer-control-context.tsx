'use client'

import { createContext, useContext, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useDisplayViewerControls } from '@/features/applications/viewer/display/display-viewer-shell/display-viewer-context'
import { renderControlIcon } from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import { useViewerControlSender } from '@/features/applications/viewer/display/viewer-control-bar/commands/use-viewer-control-sender'
import { useFloatingToolbarDrag } from '@/features/applications/viewer/display/viewer-control-bar/floating/use-floating-toolbar-drag'
import type {
  ControlIconRenderer,
  FloatingPosition,
  SendControl
} from '@/features/applications/viewer/display/viewer-control-bar/types'

type ViewerControlContextValue = {
  canCaptureScreenshot: boolean
  canControl: boolean
  controlsDisabled: boolean
  controlIcon: ControlIconRenderer
  floatingCollapsed: boolean
  floatingOpen: boolean
  floatingPosition: FloatingPosition
  fullscreen: boolean
  isCapturing: boolean
  keyboardCaptureEnabled: boolean
  runtimeAvailable: boolean
  sendControl: SendControl
  setFloatingCollapsed: Dispatch<SetStateAction<boolean>>
  setFloatingOpen: Dispatch<SetStateAction<boolean>>
  onCaptureScreenshot: () => void
  onFloatingPointerDown: ReturnType<typeof useFloatingToolbarDrag>['handleFloatingPointerDown']
  onFloatingPointerMove: ReturnType<typeof useFloatingToolbarDrag>['handleFloatingPointerMove']
  onFloatingPointerUp: ReturnType<typeof useFloatingToolbarDrag>['handleFloatingPointerUp']
  onOpenPopout?: () => void
  onToggleFullscreen?: () => void
  onToggleKeyboardCapture?: () => void
}

const ViewerControlContext = createContext<ViewerControlContextValue | null>(null)

export const ViewerControlProvider = ({
  children,
  surfaceId
}: {
  children: ReactNode
  mode: 'bar' | 'floating'
  surfaceId?: string
}) => {
  const controls = useDisplayViewerControls(surfaceId)
  const [floatingOpen, setFloatingOpen] = useState(false)
  const [floatingCollapsed, setFloatingCollapsed] = useState(false)
  const [floatingPosition, setFloatingPosition] = useState({ x: 16, y: 96 })
  const { controlsDisabled, pendingCommand, sendControl } = useViewerControlSender({
    appId: controls.appId,
    baseControlsDisabled: !controls.runtimeAvailable || !controls.canControl,
    surfaceId: controls.surfaceId,
    onRotateViewer: controls.onRotateViewer
  })
  const { handleFloatingPointerDown, handleFloatingPointerMove, handleFloatingPointerUp } = useFloatingToolbarDrag(
    floatingPosition,
    setFloatingPosition
  )
  const controlIcon: ControlIconRenderer = (command, icon) => renderControlIcon(pendingCommand, command, icon)

  return (
    <ViewerControlContext.Provider
      value={{
        canCaptureScreenshot: controls.canCaptureScreenshot,
        canControl: controls.canControl,
        controlsDisabled,
        controlIcon,
        floatingCollapsed,
        floatingOpen,
        floatingPosition,
        fullscreen: controls.fullscreen,
        isCapturing: controls.isCapturing,
        keyboardCaptureEnabled: controls.keyboardCaptureEnabled,
        runtimeAvailable: controls.runtimeAvailable,
        sendControl,
        setFloatingCollapsed,
        setFloatingOpen,
        onCaptureScreenshot: controls.onCaptureScreenshot,
        onFloatingPointerDown: handleFloatingPointerDown,
        onFloatingPointerMove: handleFloatingPointerMove,
        onFloatingPointerUp: handleFloatingPointerUp,
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
