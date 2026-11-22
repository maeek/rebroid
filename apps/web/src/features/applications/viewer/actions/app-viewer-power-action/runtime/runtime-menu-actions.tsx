'use client'

import { IconPlayerPlayFilled, IconPlayerStopFilled, IconReplace, IconRestore } from '@tabler/icons-react'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { RuntimeMenuAction } from '@/features/applications/viewer/actions/app-viewer-power-action/types'

export const createRuntimeMenuActions = ({
  app,
  canStart,
  canSwitchProfile,
  canStop,
  onStartDefaults,
  onStartProfile,
  onStop,
  onRestart,
  onRecreate
}: {
  app?: AppDefinition
  canStart: boolean
  canSwitchProfile: boolean
  canStop: boolean
  onStartDefaults: () => void
  onStartProfile: () => void
  onStop: () => void
  onRestart: () => void
  onRecreate: () => void
}): RuntimeMenuAction[] => {
  const actions: RuntimeMenuAction[] = []
  const stopped = Boolean(app && !app.running)
  const running = Boolean(app?.running)

  if (canStart) {
    actions.push({
      key: 'start-defaults',
      label: 'Start with defaults',
      icon: <IconPlayerPlayFilled className='size-4' />,
      disabled: !stopped,
      onSelect: onStartDefaults
    })
    if (canSwitchProfile) {
      actions.push({
        key: 'start-profile',
        label: 'Start with profile',
        icon: <IconPlayerPlayFilled className='size-4' />,
        disabled: !stopped,
        onSelect: onStartProfile
      })
    }
  }
  if (canStop) {
    actions.push({
      key: 'stop',
      label: 'Stop',
      icon: <IconPlayerStopFilled className='size-4' />,
      disabled: !running,
      onSelect: onStop
    })
  }
  if (canStart && canStop) {
    const canRecreate =
      stopped && app?.lifecycleStage !== 'stopping' && (app?.status === 'stopped' || app?.status === 'error')
    actions.push(
      {
        key: 'restart',
        label: 'Restart',
        icon: <IconRestore className='size-4' />,
        disabled: !running,
        onSelect: onRestart
      },
      {
        key: 'recreate',
        label: 'Recreate runtime…',
        icon: <IconReplace className='size-4' />,
        disabled: !canRecreate,
        onSelect: onRecreate
      }
    )
  }
  return actions
}
