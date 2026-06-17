import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'
import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const getAiProvidersListPageData = async (): Promise<{
  initialSettings: OrchestratorUiSettings
  orchestratorError: string | null
  providers: AutomationAiProvider[]
}> => {
  const initialSettings = await getServerOrchestratorUiSettings()

  try {
    return {
      initialSettings,
      orchestratorError: null,
      providers: await listAutomationAiProvidersAction()
    }
  } catch (error) {
    return {
      initialSettings,
      orchestratorError: errorMessage(error),
      providers: []
    }
  }
}
