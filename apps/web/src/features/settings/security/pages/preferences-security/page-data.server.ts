import { getCurrentUser } from '@/server/auth/authorization'

export const getPreferencesSecurityPageData = async () => {
  const { mfaEnabled } = await getCurrentUser()
  return { mfaEnabled }
}
