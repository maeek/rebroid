import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export const getPreferencesGeneralPageData = async () => ({
  initialSettings: await getServerOrchestratorUiSettings()
})
