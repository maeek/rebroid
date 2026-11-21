'use client'

import type { ReactNode } from 'react'
import {
  IconAdjustmentsHorizontal,
  IconChevronUp,
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
  ControlCommandState,
  ControlIconRenderer,
  IconControl,
  SendControl
} from '@/features/applications/viewer/display/viewer-control-bar/types'

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

export const panelControls: IconControl[] = [
  { command: 'expand-settings', label: 'Quick settings', icon: <IconAdjustmentsHorizontal aria-hidden /> },
  { command: 'collapse-panels', label: 'Collapse panels', icon: <IconChevronUp aria-hidden /> }
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
  commandDisabled,
  isCommandPending,
  controlIcon,
  sendControl
}: {
  buttonClassName?: string
  buttonVariant?: 'ghost' | 'secondary'
  className: string
  controls: IconControl[]
  commandDisabled: ControlCommandState
  isCommandPending: ControlCommandState
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
          size='icon-md'
          variant={buttonVariant}
          disabled={commandDisabled(command)}
          aria-busy={isCommandPending(command) || undefined}
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

export const renderControlIcon = (pending: boolean, icon: ReactNode) => (
  <span
    aria-hidden='true'
    className='relative inline-flex size-4 shrink-0 items-center justify-center'
  >
    {icon}
    {pending ? (
      <span className='absolute -right-1 -bottom-1 grid size-3 place-items-center rounded-full bg-surface-editor text-primary'>
        <IconLoader2 className='!size-2.5 motion-safe:animate-spin' />
      </span>
    ) : null}
  </span>
)
