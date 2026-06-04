'use client'

import {
  getStartedProfileOptions,
  rememberStartedProfile
} from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import {
  startApplicationAction,
  stopApplicationAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  RuntimeActionRunner,
  SetActionPhase,
  SetSavedProfiles
} from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

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
  const started = await runAction(() => startApplicationAction(app.id, options), 'Could not start app')
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
  const stopped = await runAction(() => stopApplicationAction(app.id), 'Could not stop app')
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
    await stopApplicationAction(app.id)
    await startApplicationAction(app.id)
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
