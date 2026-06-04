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
  FullscreenButton,
  KeyboardCaptureButton,
  PopoutButton
} from '@/features/applications/viewer/display/viewer-control-bar/controls/control-buttons'
import type { ViewerControlRenderProps } from '@/features/applications/viewer/display/viewer-control-bar/types'

export const StandardViewerControls = ({
  canCaptureScreenshot,
  canControl,
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
    {surfaceActions}
    <FullscreenButton
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
    />
    <PopoutButton onOpenPopout={onOpenPopout} />
    <Visible when={!canControl && runtimeAvailable}>
      <div className='text-xs text-muted-foreground'>Viewer controls are disabled by permissions.</div>
    </Visible>
  </div>
)
