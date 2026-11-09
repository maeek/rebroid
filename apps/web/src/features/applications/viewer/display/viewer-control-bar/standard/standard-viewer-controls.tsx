'use client'

import { Visible } from '@/components/ui/visible'
import {
  displayControls,
  IconCommandGroup,
  navigationControls,
  volumeControls
} from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import {
  AndroidPanelsMenu,
  CaptureScreenshotButton,
  KeyboardCaptureButton
} from '@/features/applications/viewer/display/viewer-control-bar/controls/control-buttons'
import { useViewerControlContext } from '@/features/applications/viewer/display/viewer-control-bar/viewer-control-context'

const standardControlButtonClassName = 'size-8'
const standardControlGroupClassName = 'flex flex-col items-center rounded-control bg-surface-band'

export const StandardViewerControls = () => {
  const {
    canCaptureScreenshot,
    canControl,
    controlsDisabled,
    controlIcon,
    isCapturing,
    keyboardCaptureEnabled,
    runtimeAvailable,
    sendControl,
    onCaptureScreenshot,
    onToggleKeyboardCapture
  } = useViewerControlContext()

  return (
    <div
      role='group'
      aria-label='Device controls'
      className='flex w-full flex-col items-center gap-1.5'
    >
      <IconCommandGroup
        buttonClassName={standardControlButtonClassName}
        className={standardControlGroupClassName}
        controls={navigationControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <IconCommandGroup
        buttonClassName={standardControlButtonClassName}
        className={standardControlGroupClassName}
        controls={volumeControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <IconCommandGroup
        buttonClassName={standardControlButtonClassName}
        buttonVariant='secondary'
        className='contents'
        controls={displayControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <KeyboardCaptureButton
        className={standardControlButtonClassName}
        controlsDisabled={controlsDisabled}
        keyboardCaptureEnabled={keyboardCaptureEnabled}
        onToggleKeyboardCapture={onToggleKeyboardCapture}
      />
      <AndroidPanelsMenu
        buttonClassName={standardControlButtonClassName}
        controlsDisabled={controlsDisabled}
        sendControl={sendControl}
      />
      <Visible when={runtimeAvailable && canCaptureScreenshot}>
        <CaptureScreenshotButton
          className={standardControlButtonClassName}
          isCapturing={isCapturing}
          onCaptureScreenshot={onCaptureScreenshot}
        />
      </Visible>
      <Visible when={!canControl && runtimeAvailable}>
        <span className='sr-only'>Viewer controls are disabled by permissions.</span>
      </Visible>
    </div>
  )
}
