import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'

export const getPlatformRuntimePageData = async () => ({
  initialSettings: await getServerOrchestratorUiSettings()
})
