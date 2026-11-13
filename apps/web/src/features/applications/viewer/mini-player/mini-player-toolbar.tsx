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
  disabled
}: {
  appId: string
  surfaceId: string
  disabled: boolean
}) => {
  const { controlsDisabled, pendingCommand, sendControl } = useViewerControlSender({
    appId,
    surfaceId,
    baseControlsDisabled: disabled
  })
  const controlIcon = (command: Parameters<typeof sendControl>[0], icon: React.ReactNode) =>
    renderControlIcon(pendingCommand, command, icon)
  return (
    <div
      role='group'
      aria-label='Viewer toolbar'
      className='flex flex-col items-center gap-1'
    >
      <IconCommandGroup
        className='flex flex-col items-center rounded-control bg-control p-0.5'
        controls={navigationControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <IconCommandGroup
        className='flex flex-col items-center rounded-control bg-control p-0.5'
        controls={volumeControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <IconCommandGroup
        className='flex flex-col items-center rounded-control bg-control p-0.5'
        controls={displayControls}
        controlsDisabled={controlsDisabled}
        controlIcon={controlIcon}
        sendControl={sendControl}
      />
      <AndroidPanelsMenu
        controlsDisabled={controlsDisabled}
        sendControl={sendControl}
      />
    </div>
  )
}
