'use client'

import { IconLoader2, IconPlayerPlayFilled, IconPlayerStopFilled } from '@tabler/icons-react'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { RuntimeActionPhase } from '@/features/applications/viewer/actions/app-viewer-power-action/types'

type PrimaryLabelKey = Exclude<RuntimeActionPhase, null> | 'running' | 'idle'

const runtimeActionLabels: Record<PrimaryLabelKey, string> = {
  starting: 'Starting...',
  stopping: 'Stopping...',
  restarting: 'Restarting...',
  running: 'Stop',
  idle: 'Start'
}

const getIdlePrimaryLabelKey = (app: AppDefinition | undefined, isStopping: boolean): PrimaryLabelKey =>
  isStopping ? 'stopping' : app?.running ? 'running' : 'idle'

const getPrimaryLabel = (app: AppDefinition | undefined, phase: RuntimeActionPhase, isStopping: boolean) =>
  runtimeActionLabels[phase ?? getIdlePrimaryLabelKey(app, isStopping)]

const getPrimaryIcon = (app: AppDefinition | undefined, isStopping: boolean) => {
  if (isStopping) {
    return <IconLoader2 className='size-4 animate-spin' />
  }

  return app?.running ? <IconPlayerStopFilled className='size-4' /> : <IconPlayerPlayFilled className='size-4' />
}

const getIsStopping = (app?: AppDefinition) => app?.lifecycleStage === 'stopping'

const getIsBusy = (app: AppDefinition | undefined, isStopping: boolean) =>
  [app?.status === 'provisioning', app?.status === 'removing', isStopping].some(Boolean)

export const getCanRestart = (canStart: boolean, canStop: boolean) => canStart && canStop

const getPrimaryVariant = (app?: AppDefinition): 'secondary' | 'update' => (app?.running ? 'secondary' : 'update')

const getCanRunPrimary = (app: AppDefinition | undefined, canStart: boolean, canStop: boolean) =>
  app?.running ? canStop : canStart

export const canStartDefaults = (app: AppDefinition | undefined, canStart: boolean) =>
  Boolean(app && !app.running && canStart)

export const canStartProfile = (app: AppDefinition | undefined, canStart: boolean, canSwitchProfile: boolean) =>
  Boolean(app && !app.running && canStart && canSwitchProfile)

export const canStopRuntime = (app: AppDefinition | undefined, canStop: boolean) =>
  Boolean(app && app.running && canStop)

export const canRestartRuntime = (app: AppDefinition | undefined, canRestart: boolean) =>
  Boolean(app && app.running && canRestart)

const isRuntimeMenuDisabled = (
  app: AppDefinition | undefined,
  isBusy: boolean,
  isRunningAction: boolean,
  canStart: boolean,
  canStop: boolean
) => {
  const hasAvailableAction = [canStart, canStop].some(Boolean)
  return [!app, isBusy, isRunningAction, !hasAvailableAction].some(Boolean)
}

export const usePowerActionViewState = ({
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
  const isStopping = getIsStopping(app)
  const isBusy = getIsBusy(app, isStopping)

  return {
    canRestart: getCanRestart(canStart, canStop),
    canRunPrimary: getCanRunPrimary(app, canStart, canStop),
    dialogDisabled: isRuntimeMenuDisabled(app, isBusy, isRunningAction, true, true),
    isBusy,
    isStopping,
    menuDisabled: isRuntimeMenuDisabled(app, isBusy, isRunningAction, canStart, canStop),
    primaryIcon: getPrimaryIcon(app, isStopping),
    primaryLabel: getPrimaryLabel(app, actionPhase, isStopping),
    primaryVariant: getPrimaryVariant(app)
  }
}
