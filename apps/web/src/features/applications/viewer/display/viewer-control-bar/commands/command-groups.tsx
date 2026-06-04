'use client'

import type { ReactNode } from 'react'
import {
  IconHome,
  IconLayoutSidebarRight,
  IconLoader2,
  IconPlayerTrackNext,
  IconPower,
  IconRotateClockwise2,
  IconVolume,
  IconVolume2,
  IconVolumeOff
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { IconButtonTooltip } from '@/features/applications/viewer/display/viewer-control-bar/controls/icon-button-tooltip'
import type {
  ControlIconRenderer,
  IconControl,
  SendControl
} from '@/features/applications/viewer/display/viewer-control-bar/types'
import type { ApplicationViewerControlCommand } from '@/server/orchestrator/applications/types'

export const navigationControls: IconControl[] = [
  {
    command: 'back',
    label: 'Back',
    icon: <IconPlayerTrackNext className='size-4 rotate-180' />
  },
  {
    command: 'home',
    label: 'Home',
    icon: <IconHome className='size-4' />
  },
  {
    command: 'recents',
    label: 'Recent apps',
    icon: <IconLayoutSidebarRight className='size-4' />
  }
]

export const panelControls: Array<{
  command: ApplicationViewerControlCommand
  label: string
}> = [
  { command: 'expand-notifications', label: 'Notifications' },
  { command: 'expand-settings', label: 'Quick settings' },
  { command: 'collapse-panels', label: 'Collapse panels' }
]

export const volumeControls: IconControl[] = [
  {
    command: 'volume-down',
    label: 'Volume down',
    icon: <IconVolume className='size-4' />
  },
  {
    command: 'mute',
    label: 'Mute device',
    icon: <IconVolumeOff className='size-4' />
  },
  {
    command: 'volume-up',
    label: 'Volume up',
    icon: <IconVolume2 className='size-4' />
  }
]

export const displayControls: IconControl[] = [
  {
    command: 'rotate',
    label: 'Auto-rotate display',
    icon: <IconRotateClockwise2 className='size-4' />
  },
  {
    command: 'wake',
    label: 'Wake display',
    icon: <IconPower className='size-4' />
  }
]

export const IconCommandGroup = ({
  buttonClassName = 'size-8',
  buttonVariant = 'ghost',
  className,
  controls,
  controlsDisabled,
  controlIcon,
  sendControl
}: {
  buttonClassName?: string
  buttonVariant?: 'ghost' | 'secondary'
  className: string
  controls: IconControl[]
  controlsDisabled: boolean
  controlIcon: ControlIconRenderer
  sendControl: SendControl
}) => (
  <div className={className}>
    {controls.map(({ command, label, icon }) => (
      <IconButtonTooltip
        key={command}
        label={label}
      >
        <Button
          size='icon'
          variant={buttonVariant}
          disabled={controlsDisabled}
          onClick={() => sendControl(command)}
          aria-label={label}
          className={buttonClassName}
        >
          {controlIcon(command, icon)}
        </Button>
      </IconButtonTooltip>
    ))}
  </div>
)

export const renderControlIcon = (
  pendingCommand: ApplicationViewerControlCommand | null,
  command: ApplicationViewerControlCommand,
  icon: ReactNode
) => (pendingCommand === command ? <IconLoader2 className='size-4 animate-spin' /> : icon)
