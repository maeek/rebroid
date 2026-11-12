import { PublicActionError } from '@/server/errors/public-action-error'
import { getWebSettings } from '@/server/web-settings/store'
import { passwordMinimumLengthLimits } from '@/shared/model/settings/password-minimum-length'

export const getPasswordMinimumLength = async () => {
  try {
    return (await getWebSettings()).passwordMinimumLength
  } catch {
    return passwordMinimumLengthLimits.default
  }
}

export const assertPasswordMeetsPolicy = async (password: string) => {
  if (typeof password !== 'string' || password.length === 0) {
    throw new PublicActionError('Password is required.', { code: 'validation', status: 422 })
  }
  const passwordMinimumLength = await getPasswordMinimumLength()
  if (password.length < passwordMinimumLength) {
    throw new PublicActionError(`Password must be at least ${passwordMinimumLength} characters.`, {
      code: 'validation',
      status: 422
    })
  }
  if (password.length > passwordMinimumLengthLimits.max || Buffer.byteLength(password, 'utf8') > 512) {
    throw new PublicActionError(`Password must not exceed ${passwordMinimumLengthLimits.max} characters.`, {
      code: 'validation',
      status: 422
    })
  }
  return passwordMinimumLength
}
