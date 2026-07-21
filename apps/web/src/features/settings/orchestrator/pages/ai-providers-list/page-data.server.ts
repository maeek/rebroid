import { getServerOrchestratorUiSettings } from '@/server/orchestrator/get-server-ui-settings'
import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'
import type { AutomationAiProvider } from '@/shared/contracts/ai-provider'
import type { OrchestratorUiSettings } from '@/shared/model/settings/orchestrator-ui-settings'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const getAiProvidersListPageData = async (): Promise<{
  initialSettings: OrchestratorUiSettings
  orchestratorError: string | null
  providers: AutomationAiProvider[]
}> => {
  const initialSettingsPromise = getServerOrchestratorUiSettings()

  try {
    const [initialSettings, providers] = await Promise.all([initialSettingsPromise, listAutomationAiProvidersAction()])

    return {
      initialSettings,
      orchestratorError: null,
      providers
    }
  } catch (error) {
    return {
      initialSettings: await initialSettingsPromise,
      orchestratorError: errorMessage(error),
      providers: []
    }
  }
}
