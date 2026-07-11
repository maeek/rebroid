import { PublicActionError } from '@/server/errors/public-action-error'
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
    throw new PublicActionError(`Password must be at least ${passwordMinimumLength} characters.`, {
      code: 'validation',
      status: 422
    })
  }
  if (password.length > 128 || Buffer.byteLength(password, 'utf8') > 512) {
    throw new PublicActionError('Password must not exceed 128 characters.', { code: 'validation', status: 422 })
  }
  return passwordMinimumLength
}
