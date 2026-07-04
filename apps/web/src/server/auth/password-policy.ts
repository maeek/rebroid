import { getWebSettings } from '@/server/web-settings/store'
import { defaultPasswordMinimumLength } from './user-model'

export const getPasswordMinimumLength = async () => {
  try {
    return (await getWebSettings()).passwordMinimumLength
  } catch {
    return defaultPasswordMinimumLength
  }
}

export const assertPasswordMeetsPolicy = async (password: string) => {
  const passwordMinimumLength = await getPasswordMinimumLength()
  if (password.length < passwordMinimumLength) {
    throw new Error(`Password must be at least ${passwordMinimumLength} characters.`)
  }
  return passwordMinimumLength
}
