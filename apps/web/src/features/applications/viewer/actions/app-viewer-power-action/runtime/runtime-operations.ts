'use client'

import {
  getStartedProfileOptions,
  rememberStartedProfile
} from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import {
  requestApplicationStartAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  RuntimeActionRunner,
  SetActionPhase,
  SetSavedProfiles
} from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/shared/contracts/application'

export const startAppRuntime = async ({
  app,
  options,
  runAction,
  setActionPhase,
  setSavedProfiles
}: {
  app?: AppDefinition
  options?: { profileMode?: ApplicationProfileMode; profileName?: string }
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
  setSavedProfiles: SetSavedProfiles
}) => {
  if (!app) {
    return false
  }

  setActionPhase('starting')
  const started = await runAction(
    async () => unwrapActionResult(await requestApplicationStartAction(app.id, options)),
    'Could not start app'
  )
  setActionPhase(null)

  const startedProfile = getStartedProfileOptions(started, options)

  if (startedProfile) {
    rememberStartedProfile(app.id, startedProfile, setSavedProfiles)
  }

  return started
}

export const stopAppRuntime = async ({
  app,
  runAction,
  setActionPhase
}: {
  app?: AppDefinition
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
}) => {
  if (!app) {
    return false
  }

  setActionPhase('stopping')
  const stopped = await runAction(
    async () => unwrapActionResult(await requestApplicationStopAction(app.id)),
    'Could not stop app'
  )
  setActionPhase(null)
  return stopped
}

export const restartAppRuntime = async ({
  app,
  runAction,
  setActionPhase
}: {
  app?: AppDefinition
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
}) => {
  if (!app) {
    return false
  }

  setActionPhase('restarting')
  const didSucceed = await runAction(async () => {
    unwrapActionResult(await requestApplicationStopAction(app.id))
    unwrapActionResult(await requestApplicationStartAction(app.id))
  }, 'Could not restart app')
  setActionPhase(null)
  return didSucceed
}

export const openPrimaryRuntimeAction = ({
  app,
  canSwitchProfile,
  onStart,
  onStartProfile,
  onStop
}: {
  app?: AppDefinition
  canSwitchProfile: boolean
  onStart: () => void
  onStartProfile: () => void
  onStop: () => void
}) => {
  if (!app) {
    return
  }

  if (app.running) {
    onStop()
    return
  }

  if (canSwitchProfile) {
    onStartProfile()
    return
  }

  onStart()
}

export const closeDialogOnSuccess = (success: boolean, close: () => void) => {
  if (success) {
    close()
  }
}
