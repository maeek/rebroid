import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export const getOrchestratorSettingsPageData = async () => ({
  initialSettings: await getServerOrchestratorUiSettings()
})
