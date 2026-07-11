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
const standardControlGroupClassName =
  'flex h-8 items-center overflow-hidden rounded-control border border-surface-border/60 bg-surface-band/55'

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
    surfaceActions,
    onCaptureScreenshot,
    onToggleKeyboardCapture
  } = useViewerControlContext()

  return (
    <div className='z-50 flex w-full flex-wrap items-center justify-center gap-1.5 pb-1'>
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
      {surfaceActions}
      <Visible when={!canControl && runtimeAvailable}>
        <div className='text-xs text-foreground-muted'>Viewer controls are disabled by permissions.</div>
      </Visible>
    </div>
  )
}
