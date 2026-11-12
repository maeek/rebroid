import { requireAdmin } from '@/server/auth/authorization'
import { getWebSettings } from '@/server/web-settings/store'
import { pickGeneralUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

export const getConsoleDefaultsPageData = async () => {
  await requireAdmin()
  return { initialSettings: pickGeneralUiSettings(await getWebSettings()) }
}
