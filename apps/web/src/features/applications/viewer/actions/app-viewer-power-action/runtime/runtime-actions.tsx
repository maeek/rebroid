'use client'

import { useRef, useState } from 'react'
import { getNormalizedProfileName } from '@/features/applications/viewer/actions/app-viewer-power-action/profile/profile-state'
import {
  recreateApplicationAction,
  requestApplicationStartAction,
  requestApplicationStopAction
} from '@/server/orchestrator/applications/actions/lifecycle/lifecycle-actions'
import { unwrapActionResult } from '@/shared/actions/action-result'
import { rememberApplicationProfile } from '@/shared/model/application-profile/profile-history'
import { notifyRecentAppsUpdated } from '@/shared/model/recent-apps/recent-apps'
import type {
  PowerActionRuntimeHandlersOptions,
  RuntimeActionPhase
} from '@/features/applications/viewer/actions/app-viewer-power-action/types'

const stopRuntime = async (appId: string) => {
  unwrapActionResult(await requestApplicationStopAction(appId))
  notifyRecentAppsUpdated()
}

export const usePowerActionRuntimeHandlers = ({
  app,
  canSwitchProfile,
  profileMode,
  profileName,
  runAction,
  setRestartDialogOpen,
  setStartDialogOpen,
  setStopDialogOpen
}: PowerActionRuntimeHandlersOptions) => {
  const [actionPhase, setActionPhase] = useState<RuntimeActionPhase>(null)
  const [recreateDialogOpen, setRecreateDialogOpen] = useState(false)

  const pending = useRef(false)

  const run = async (
    phase: NonNullable<RuntimeActionPhase>,
    title: string,
    action: (appId: string) => Promise<unknown>
  ) => {
    if (!app || pending.current) return false
    pending.current = true
    setActionPhase(phase)
    try {
      return await runAction(() => action(app.id), title)
    } finally {
      pending.current = false
      setActionPhase(null)
    }
  }

  const startWithDefaults = () =>
    run('starting', 'Could not start app', async id => unwrapActionResult(await requestApplicationStartAction(id)))

  const handleProfileStart = async () => {
    if (!app) return
    const name = getNormalizedProfileName(profileMode, profileName)
    const started = await run('starting', 'Could not start app', async id =>
      unwrapActionResult(await requestApplicationStartAction(id, { profileMode, profileName: name }))
    )
    if (started) {
      rememberApplicationProfile(app.id, { mode: profileMode, name })
      setStartDialogOpen(false)
    }
  }

  const handleStopConfirm = async () => {
    if (await run('stopping', 'Could not stop app', stopRuntime)) setStopDialogOpen(false)
  }

  const handleRestart = async () => {
    const restarted = await run('restarting', 'Could not restart app', async id => {
      await stopRuntime(id)
      unwrapActionResult(await requestApplicationStartAction(id))
    })
    if (restarted) setRestartDialogOpen(false)
  }

  const handleRecreate = async () => {
    const recreated = await run('recreating', 'Could not recreate runtime', async id =>
      unwrapActionResult(await recreateApplicationAction(id))
    )
    if (recreated) setRecreateDialogOpen(false)
  }

  const handlePrimaryAction = () => {
    if (!app) return
    if (app.running) setStopDialogOpen(true)
    else if (canSwitchProfile) setStartDialogOpen(true)
    else void startWithDefaults()
  }

  return {
    actionPhase,
    startWithDefaults,
    handlePrimaryAction,
    handleProfileStart,
    handleRestart,
    handleStopConfirm,
    handleRecreate,
    recreateDialogOpen,
    setRecreateDialogOpen
  }
}
