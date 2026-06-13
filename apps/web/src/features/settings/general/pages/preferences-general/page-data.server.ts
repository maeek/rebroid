import { getCurrentUser } from '@/server/auth/authorization'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export const getPreferencesGeneralPageData = async () => {
  const [currentUser, initialSettings] = await Promise.all([getCurrentUser(), getServerOrchestratorUiSettings()])

  return { currentUser, initialSettings }
}
