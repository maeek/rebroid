'use client'

import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { RuntimeActionPhase } from '@/features/applications/viewer/actions/app-viewer-power-action/types'

type PrimaryLabelKey = Exclude<RuntimeActionPhase, null> | 'running' | 'idle'

export const runtimeActionLabels: Record<PrimaryLabelKey, string> = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  restarting: 'Restarting...',
  recreating: 'Recreating...',
  running: 'Stop',
  idle: 'Start'
}

export const getPowerActionViewState = ({
  actionPhase,
  app,
  canStart,
  canStop,
  isRunningAction
}: {
  actionPhase: RuntimeActionPhase
  app?: AppDefinition
  canStart: boolean
  canStop: boolean
  isRunningAction: boolean
}) => {
  const isStopping = app?.lifecycleStage === 'stopping'
  const isBusy = isStopping || app?.status === 'provisioning' || app?.status === 'removing'
  const dialogDisabled = !app || isBusy || isRunningAction
  let labelKey: PrimaryLabelKey = app?.running ? 'running' : 'idle'
  if (isStopping) labelKey = 'stopping'

  return {
    canRunPrimary: app?.running ? canStop : canStart,
    dialogDisabled,
    isBusy,
    menuDisabled: dialogDisabled || (!canStart && !canStop),
    primaryLabel: runtimeActionLabels[actionPhase ?? labelKey],
    primaryVariant: app?.running ? ('secondary' as const) : ('primary' as const)
  }
}
