import type { ApplicationProfileMode } from '@/shared/contracts/application'

export type SavedApplicationProfile = {
  mode: ApplicationProfileMode
  name: string
}

export const savedApplicationProfiles = (
  current: SavedApplicationProfile,
  serverProfiles: SavedApplicationProfile[] = []
) => {
  const profiles = [current, ...serverProfiles]
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

  try {
    window.localStorage.setItem(`rebroid.app-profiles.${appId}`, JSON.stringify([profile]))
  } catch {
    // The server already accepted the start even if browser storage is unavailable.
  }
}
