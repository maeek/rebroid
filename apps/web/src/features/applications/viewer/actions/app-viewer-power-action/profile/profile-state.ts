'use client'

import { useEffect, useState } from 'react'
import { savedApplicationProfiles } from '@/shared/model/application-profile/profile-history'
import type { AppDefinition } from '@/features/applications/domain/app-definition'
import type { ApplicationProfileMode } from '@/shared/contracts/application'

export const getNormalizedProfileName = (mode: ApplicationProfileMode, name: string) =>
  mode === 'temporary' ? 'temporary' : name.trim() || 'default'

const getNextProfileNameForMode = (mode: ApplicationProfileMode, currentName: string) => {
  if (mode === 'temporary') {
    return 'temporary'
  }

  return currentName === 'temporary' ? 'default' : currentName
}

export const usePowerActionProfileState = (app: AppDefinition | undefined, startDialogOpen: boolean) => {
  const activeMode = app?.profileMode ?? 'persistent'
  const activeName = app?.profileName ?? 'default'
  const [profileMode, setProfileMode] = useState<ApplicationProfileMode>(activeMode)
  const [profileName, setProfileName] = useState(activeName)
  const savedProfiles = app ? savedApplicationProfiles({ mode: activeMode, name: activeName }, app.savedProfiles) : []

  useEffect(() => {
    if (!app || startDialogOpen) return
    setProfileMode(activeMode)
    setProfileName(activeName)
  }, [app, activeMode, activeName, startDialogOpen])

  const handleProfileModeChange = (mode: ApplicationProfileMode) => {
    setProfileMode(mode)
    setProfileName(current => getNextProfileNameForMode(mode, current))
  }

  return {
    profileMode,
    profileName,
    savedProfiles,
    setProfileName,
    handleProfileModeChange
  }
}
