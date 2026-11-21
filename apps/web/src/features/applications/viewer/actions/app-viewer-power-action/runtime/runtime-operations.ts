'use client'

import {
  requestApplicationStartAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { rememberApplicationProfile } from '@/shared/model/application-profile/profile-history'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type {
  RuntimeActionRunner,
  SetActionPhase
} from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/shared/contracts/application'

export const startAppRuntime = async ({
  app,
  options,
  runAction,
  setActionPhase
}: {
  app?: AppDefinition
  options?: { profileMode?: ApplicationProfileMode; profileName?: string }
  runAction: RuntimeActionRunner
  setActionPhase: SetActionPhase
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

  if (started && options?.profileMode) {
    rememberApplicationProfile(app.id, { mode: options.profileMode, name: options.profileName?.trim() || 'default' })
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
  const stopped = await runAction(async () => {
    const result = unwrapActionResult(await requestApplicationStopAction(app.id))
    notifyRecentAppsUpdated()
    return result
  }, 'Could not stop app')
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
    notifyRecentAppsUpdated()
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
