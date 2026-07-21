import { listAutomationCommandsAction } from '@/server/orchestrator/automations/automation-management-actions'
import type { AutomationCommand } from '@/shared/contracts/automation'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const loadAutomationCreatePageData = async (): Promise<{
  commands: AutomationCommand[]
  orchestratorError: string | null
}> => {
  try {
    return {
      commands: await listAutomationCommandsAction(),
      orchestratorError: null
    }
  } catch (error) {
    return {
      commands: [],
      orchestratorError: errorMessage(error)
    }
  }
}
