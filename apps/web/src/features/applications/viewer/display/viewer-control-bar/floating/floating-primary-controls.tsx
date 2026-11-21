'use client'

import {
  displayControls,
  IconCommandGroup,
  navigationControls,
  panelControls,
  volumeControls
} from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import {
  CaptureScreenshotButton,
  KeyboardCaptureButton,
  PopoutButton
} from '@/features/applications/viewer/display/viewer-control-bar/controls/control-buttons'
import { useViewerControlContext } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-context'

const fullscreenCommands = [...navigationControls, ...volumeControls, ...displayControls, ...panelControls]

export const FloatingPrimaryControls = ({ buttonClassName }: { buttonClassName: string }) => {
  const {
    canCaptureScreenshot,
    canControl,
    controlsDisabled,
    commandDisabled,
    isCommandPending,
    controlIcon,
    isCapturing,
    keyboardCaptureEnabled,
    runtimeAvailable,
    sendControl,
    onCaptureScreenshot,
    onOpenPopout,
    onToggleKeyboardCapture
  } = useViewerControlContext()

  return (
    <div className='scrollbar-none grid min-h-0 grid-cols-3 gap-1 overflow-y-auto transform-gpu overscroll-contain border-t border-surface-border/60 p-1'>
      {runtimeAvailable && canControl && (
        <>
          <IconCommandGroup
            buttonClassName={buttonClassName}
            className='contents'
            controls={fullscreenCommands}
            commandDisabled={commandDisabled}
            isCommandPending={isCommandPending}
            controlIcon={controlIcon}
            sendControl={sendControl}
          />
          <KeyboardCaptureButton
            className={buttonClassName}
            controlsDisabled={controlsDisabled}
            keyboardCaptureEnabled={keyboardCaptureEnabled}
            onToggleKeyboardCapture={onToggleKeyboardCapture}
          />
        </>
      )}
      {runtimeAvailable && canCaptureScreenshot && (
        <CaptureScreenshotButton
          className={buttonClassName}
          isCapturing={isCapturing}
          onCaptureScreenshot={onCaptureScreenshot}
        />
      )}
      <PopoutButton
        className={buttonClassName}
        onOpenPopout={onOpenPopout}
      />
    </div>
  )
}
