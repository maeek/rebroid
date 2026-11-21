'use client'

import {
  displayControls,
  IconCommandGroup,
  navigationControls,
  renderControlIcon,
  volumeControls
} from '@/features/applications/viewer/display/viewer-control-bar/commands/command-groups'
import { useViewerControlSender } from '@/features/applications/viewer/display/viewer-control-bar/commands/use-viewer-control-sender'
import { AndroidPanelsMenu } from '@/features/applications/viewer/display/viewer-control-bar/controls/control-buttons'

export const MiniPlayerToolbar = ({
  appId,
  surfaceId,
  disabled,
  frameKey
}: {
  appId: string
  surfaceId: string
  disabled: boolean
  frameKey: string
}) => {
  const { commandDisabled, isCommandPending, sendControl } = useViewerControlSender({
    appId,
    surfaceId,
    frameKey,
    baseControlsDisabled: disabled
  })
  const controlIcon = (command: Parameters<typeof sendControl>[0], icon: React.ReactNode) =>
    renderControlIcon(isCommandPending(command), icon)
  return (
    <div
      role='group'
      aria-label='Viewer toolbar'
      className='flex flex-col items-center gap-1'
    >
      <IconCommandGroup
        className='flex flex-col items-center rounded-control bg-control p-0.5'
        controls={navigationControls}
        commandDisabled={commandDisabled}
        isCommandPending={isCommandPending}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <IconCommandGroup
        className='flex flex-col items-center rounded-control bg-control p-0.5'
        controls={volumeControls}
        commandDisabled={commandDisabled}
        isCommandPending={isCommandPending}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <IconCommandGroup
        className='flex flex-col items-center rounded-control bg-control p-0.5'
        controls={displayControls}
        commandDisabled={commandDisabled}
        isCommandPending={isCommandPending}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <AndroidPanelsMenu
        commandDisabled={commandDisabled}
        isCommandPending={isCommandPending}
        sendControl={sendControl}
      />
    </div>
  )
}
