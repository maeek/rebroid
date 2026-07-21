'use client'

import { IconLoader2, IconPlayerRecord, IconPlayerStop } from '@tabler/icons-react'
import { Visible } from '@/components/ui/visible'
import { IconActionButton } from '@/features/applications/viewer/display/display-viewer-shell/surface/icon-action-button'
import type { ApplicationDisplayRecording } from '@/shared/contracts/application'

export const SurfaceToolbarActions = ({
  isRecordingBusy,
  recording,
  canRecord,
  onToggleRecording,
  buttonClassName = 'size-9'
}: {
  isRecordingBusy: boolean
  recording?: ApplicationDisplayRecording
  canRecord: boolean
  onToggleRecording: () => void
  buttonClassName?: string
}) => (
  <>
    <Visible when={canRecord}>
      <IconActionButton
        label={recording?.status === 'recording' ? 'Stop recording' : 'Start recording'}
        disabled={isRecordingBusy}
        onClick={onToggleRecording}
        className={buttonClassName}
      >
        {isRecordingBusy ? (
          <IconLoader2 className='size-4 animate-spin' />
        ) : recording?.status === 'recording' ? (
          <IconPlayerStop className='size-4' />
        ) : (
          <IconPlayerRecord className='size-4' />
        )}
      </IconActionButton>
    </Visible>
  </>
)
