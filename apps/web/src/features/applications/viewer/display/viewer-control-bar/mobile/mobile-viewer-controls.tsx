'use client'

import { useState, type ReactNode } from 'react'
import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconDots,
  IconExternalLink,
  IconKeyboard,
  IconPhoto,
  IconX
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { MutationButton } from '@/components/ui/mutation-button'
import {
  displayControls,
  IconCommandGroup,
  navigationControls,
  panelControls,
  volumeControls
} from '../commands/command-groups'
import { IconButtonTooltip } from '../controls/icon-button-tooltip'
import { useViewerControlContext, ViewerControlProvider } from '../viewer-control-context'
import { MobileViewerActionRows, mobileViewerActionRowClassName } from './mobile-viewer-action-rows'

export const MobileViewerControls = ({
  surfaceId,
  controlsEnabled,
  actions,
  onFullscreen
}: {
  surfaceId: string
  controlsEnabled: boolean
  actions?: ReactNode
  onFullscreen?: () => boolean
}) => (
  <ViewerControlProvider surfaceId={surfaceId}>
    <MobileControlBar
      controlsEnabled={controlsEnabled}
      actions={actions}
      onFullscreen={onFullscreen}
    />
  </ViewerControlProvider>
)

const MobileControlBar = ({
  controlsEnabled,
  actions,
  onFullscreen
}: {
  controlsEnabled: boolean
  actions?: ReactNode
  onFullscreen?: () => boolean
}) => {
  const { canControl, controlsDisabled, controlIcon, fullscreen, onToggleFullscreen, sendControl } =
    useViewerControlContext()

  return (
    <div
      role='group'
      aria-label='Device controls'
      className='mx-auto mb-2 flex min-h-11 shrink-0 items-center gap-1 rounded-control bg-surface-editor px-1'
    >
      {controlsEnabled && canControl ? (
        <IconCommandGroup
          className='flex items-center gap-1'
          buttonClassName='size-11'
          controls={navigationControls}
          controlsDisabled={controlsDisabled}
          controlIcon={controlIcon}
          sendControl={sendControl}
        />
      ) : null}
      <IconButtonTooltip label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
        <Button
          type='button'
          size='icon-md'
          variant='ghost'
          className='size-11'
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={() => {
            if (!onFullscreen?.()) onToggleFullscreen?.()
          }}
        >
          {fullscreen ? <IconArrowsMinimize aria-hidden /> : <IconArrowsMaximize aria-hidden />}
        </Button>
      </IconButtonTooltip>
      <MobileControlDrawer controlsEnabled={controlsEnabled}>{actions}</MobileControlDrawer>
    </div>
  )
}

const MobileControlDrawer = ({ controlsEnabled, children }: { controlsEnabled: boolean; children: ReactNode }) => {
  const [open, setOpen] = useState(false)
  const {
    canCaptureScreenshot,
    canControl,
    controlsDisabled,
    controlIcon,
    isCapturing,
    keyboardCaptureEnabled,
    onCaptureScreenshot,
    onOpenPopout,
    onToggleKeyboardCapture,
    sendControl
  } = useViewerControlContext()

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
    >
      <DrawerTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon-md'
          className='size-11'
          aria-label='More device controls'
        >
          <IconDots aria-hidden />
        </Button>
      </DrawerTrigger>
      <DrawerContent className='max-h-[85svh]'>
        <div className='flex shrink-0 items-center justify-between gap-2 px-4'>
          <DrawerTitle>Device controls</DrawerTitle>
          <DrawerDescription className='sr-only'>
            Commands and viewer settings for the selected display.
          </DrawerDescription>
          <Button
            type='button'
            variant='ghost'
            size='icon-md'
            className='size-11'
            aria-label='Close device controls'
            onClick={() => setOpen(false)}
          >
            <IconX aria-hidden />
          </Button>
        </div>
        <div className='min-h-0 overflow-y-auto transform-gpu overscroll-contain px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]'>
          {controlsEnabled && canControl ? (
            <>
              {[...volumeControls, ...displayControls, ...panelControls].map(control => (
                <Button
                  key={control.command}
                  type='button'
                  variant='ghost'
                  className={mobileViewerActionRowClassName}
                  disabled={controlsDisabled}
                  onClick={() => sendControl(control.command)}
                >
                  {controlIcon(control.command, control.icon)}
                  {control.label}
                </Button>
              ))}
              <Button
                type='button'
                variant='ghost'
                className={mobileViewerActionRowClassName}
                disabled={controlsDisabled}
                aria-pressed={keyboardCaptureEnabled}
                onClick={onToggleKeyboardCapture}
              >
                <IconKeyboard aria-hidden />
                Keyboard capture
              </Button>
            </>
          ) : null}
          {controlsEnabled && canCaptureScreenshot ? (
            <MutationButton
              type='button'
              variant='ghost'
              className={mobileViewerActionRowClassName}
              pending={isCapturing}
              pendingLabel='Capturing screenshot…'
              onClick={onCaptureScreenshot}
            >
              <IconPhoto aria-hidden />
              Capture screenshot
            </MutationButton>
          ) : null}
          <MobileViewerActionRows.Provider value>{children}</MobileViewerActionRows.Provider>
          {onOpenPopout ? (
            <Button
              type='button'
              variant='ghost'
              className={mobileViewerActionRowClassName}
              onClick={onOpenPopout}
            >
              <IconExternalLink aria-hidden />
              Open viewer in new window
            </Button>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
