import { listAutomationAiProvidersAction } from '@/server/orchestrator/settings/actions'
import type { AutomationAiProvider } from '@/server/orchestrator/settings/types'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const getAiProvidersListPageData = async (): Promise<{
  orchestratorError: string | null
  providers: AutomationAiProvider[]
}> => {
  try {
    return {
      orchestratorError: null,
      providers: await listAutomationAiProvidersAction()
    }
  } catch (error) {
    return {
      orchestratorError: errorMessage(error),
      providers: []
    }
  }
}
