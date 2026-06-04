'use client'

import { Visible } from '@/components/ui/visible'
import {
  displayControls,
  IconCommandGroup,
  volumeControls
} from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import {
  AndroidPanelsMenu,
  CaptureScreenshotButton,
  FullscreenButton,
  KeyboardCaptureButton,
  PopoutButton
} from '@/features/applications/viewer/display/viewer-control-bar/controls/control-buttons'
import type { ViewerControlRenderProps } from '@/features/applications/viewer/display/viewer-control-bar/types'

export const FloatingPrimaryControls = ({
  canCaptureScreenshot,
  controlsDisabled,
  controlIcon,
  fullscreen,
  isCapturing,
  keyboardCaptureEnabled,
  runtimeAvailable,
  sendControl,
  surfaceActions,
  onCaptureScreenshot,
  onOpenPopout,
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
    {surfaceActions}
    <FullscreenButton
      className='size-9'
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
    <PopoutButton
      className='size-9'
      onOpenPopout={onOpenPopout}
    />
  </>
)
