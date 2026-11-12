import { getCurrentUser } from '@/server/auth/authorization'

export const getPreferencesGeneralPageData = async () => {
  const { name, avatarDataUrl, accentColor } = await getCurrentUser()
  return { user: { name, avatarDataUrl, accentColor } }
}
