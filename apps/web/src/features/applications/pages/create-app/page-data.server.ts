import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export const getCreateAppPageData = async () => {
  const [initialSettings, user] = await Promise.all([getServerOrchestratorUiSettings(), getCurrentUserContext()])

  return {
    initialSettings,
    permissions: user.permissions
  }
}
