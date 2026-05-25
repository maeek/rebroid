import type { ApplicationProfileMode } from '@/server/orchestrator/applications/types'

export type SavedApplicationProfile = {
  mode: ApplicationProfileMode
  name: string
}

const keyFor = (appId: string) => `rebroid.app-profiles.${appId}`

export const loadSavedApplicationProfiles = (
  _appId: string,
  current?: SavedApplicationProfile,
  serverProfiles: SavedApplicationProfile[] = []
) => {
  const profiles = current ? [current, ...serverProfiles] : serverProfiles
  const seen = new Set<string>()
  return profiles
    .filter(
      profile =>
        (profile.mode === 'persistent' || profile.mode === 'temporary') &&
        typeof profile.name === 'string' &&
        profile.name.trim()
    )
    .filter(profile => {
      const key = `${profile.mode}:${profile.name}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const rememberApplicationProfile = (appId: string, profile: SavedApplicationProfile) => {
  if (typeof window === 'undefined') {
    return
  }

  const name = profile.name.trim() || 'default'
  const profiles = loadSavedApplicationProfiles(appId, { mode: profile.mode, name })
  window.localStorage.setItem(keyFor(appId), JSON.stringify(profiles.slice(0, 12)))
}
