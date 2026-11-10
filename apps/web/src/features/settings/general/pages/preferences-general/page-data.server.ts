import { getCurrentUser } from '@/server/auth/authorization'
import { getWebSettings } from '@/server/web-settings/store'
import { defaultWebSettingsResponse, pickGeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const getPreferencesGeneralPageData = async () => {
  const { name, avatarDataUrl, mfaEnabled, accentColor, role } = await getCurrentUser()
  const initialSettings =
    role === 'admin' ? pickGeneralUiSettings(await getWebSettings().catch(() => defaultWebSettingsResponse)) : undefined

  return { user: { name, avatarDataUrl, mfaEnabled, accentColor }, initialSettings }
}
