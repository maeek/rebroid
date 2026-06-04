'use client'

import { IconPlayerPlayFilled, IconPlayerStopFilled, IconRestore } from '@tabler/icons-react'
import {
  canRestartRuntime,
  canStartDefaults,
  canStartProfile,
  canStopRuntime
} from '@/features/applications/viewer/actions/app-viewer-power-action/runtime/runtime-view-state'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { RuntimeMenuAction } from '@/features/applications/viewer/actions/app-viewer-power-action/types'

export const createRuntimeMenuActions = ({
  app,
  canStart,
  canSwitchProfile,
  canStop,
  canRestart,
  onStartDefaults,
  onStartProfile,
  onStop,
  onRestart
}: {
  app?: AppDefinition
  canStart: boolean
  canSwitchProfile: boolean
  canStop: boolean
  canRestart: boolean
  onStartDefaults: () => void
  onStartProfile: () => void
  onStop: () => void
  onRestart: () => void
}): RuntimeMenuAction[] => [
  {
    key: 'start-defaults',
    label: 'Start with defaults',
    icon: <IconPlayerPlayFilled className='size-4' />,
    disabled: !canStartDefaults(app, canStart),
    onSelect: onStartDefaults
  },
  {
    key: 'start-profile',
    label: 'Start with profile',
    icon: <IconPlayerPlayFilled className='size-4' />,
    disabled: !canStartProfile(app, canStart, canSwitchProfile),
    onSelect: onStartProfile
  },
  {
    key: 'stop',
    label: 'Stop',
    icon: <IconPlayerStopFilled className='size-4' />,
    disabled: !canStopRuntime(app, canStop),
    onSelect: onStop
  },
  {
    key: 'restart',
    label: 'Restart',
    icon: <IconRestore className='size-4' />,
    disabled: !canRestartRuntime(app, canRestart),
    onSelect: onRestart
  }
]
