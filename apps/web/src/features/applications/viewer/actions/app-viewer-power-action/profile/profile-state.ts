'use client'

import { useEffect, useState } from 'react'
import {
  loadSavedApplicationProfiles,
  rememberApplicationProfile
} from '@/shared/model/application-profile/profile-history'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { SetSavedProfiles } from '@/features/applications/viewer/actions/app-viewer-power-action/types'
import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

export const getProfileDefaults = (app: AppDefinition) => ({
  mode: app.profileMode ?? 'persistent',
  name: app.profileName ?? 'default'
})

const getInitialProfileMode = (app?: AppDefinition): ApplicationProfileMode => app?.profileMode ?? 'persistent'

const getInitialProfileName = (app?: AppDefinition) => app?.profileName ?? 'default'

const getInitialSavedProfiles = (app?: AppDefinition) => {
  if (!app) {
    return []
  }

  return loadSavedApplicationProfiles(app.id, getProfileDefaults(app), app.savedProfiles)
}

export const getNormalizedProfileName = (mode: ApplicationProfileMode, name: string) =>
  mode === 'temporary' ? 'temporary' : name.trim() || 'default'

export const getNextProfileNameForMode = (mode: ApplicationProfileMode, currentName: string) => {
  if (mode === 'temporary') {
    return 'temporary'
  }

  return currentName === 'temporary' ? 'default' : currentName
}

export const getStartedProfileOptions = (
  started: boolean,
  options?: { profileMode?: ApplicationProfileMode; profileName?: string }
) => {
  if (!started || !options?.profileMode) {
    return null
  }

  return { profileMode: options.profileMode, profileName: options.profileName }
}

export const rememberStartedProfile = (
  appId: string,
  options: { profileMode: ApplicationProfileMode; profileName?: string },
  setSavedProfiles: SetSavedProfiles
) => {
  const profile = {
    mode: options.profileMode,
    name: options.profileName?.trim() || 'default'
  }

  rememberApplicationProfile(appId, profile)
  setSavedProfiles(loadSavedApplicationProfiles(appId, profile))
}

const syncProfileStateFromApp = ({
  app,
  startDialogOpen,
  setProfileMode,
  setProfileName,
  setSavedProfiles
}: {
  app?: AppDefinition
  startDialogOpen: boolean
  setProfileMode: (mode: ApplicationProfileMode) => void
  setProfileName: (name: string) => void
  setSavedProfiles: SetSavedProfiles
}) => {
  if (!app || startDialogOpen) {
    return
  }

  const defaults = getProfileDefaults(app)
  setProfileMode(defaults.mode)
  setProfileName(defaults.name)
  setSavedProfiles(loadSavedApplicationProfiles(app.id, defaults, app.savedProfiles))
}

export const usePowerActionProfileState = (app: AppDefinition | undefined, startDialogOpen: boolean) => {
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(() => getInitialProfileMode(app))
  const [profileName, setProfileName] = useState(() => getInitialProfileName(app))
  const [savedProfiles, setSavedProfiles] = useState(() => getInitialSavedProfiles(app))

  useEffect(() => {
    syncProfileStateFromApp({
      app,
      startDialogOpen,
      setProfileMode,
      setProfileName,
      setSavedProfiles
    })
  }, [app, startDialogOpen])

  const handleProfileModeChange = (mode: ApplicationProfileMode) => {
    setProfileMode(mode)
    setProfileName(current => getNextProfileNameForMode(mode, current))
  }

  return {
    profileMode,
    profileName,
    savedProfiles,
    setProfileName,
    setSavedProfiles,
    handleProfileModeChange
  }
}
