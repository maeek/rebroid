import { notFound } from 'next/navigation'
import {
  getAutomationAction,
  listAutomationCommandsAction
} from '@/server/orchestrator/automations/automation-management-actions'
import type { Automation, AutomationCommand } from '@/shared/contracts/automation'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The orchestrator API is not responding.'

export const loadAutomationEditPageData = async (
  id: string
): Promise<{
  automation: Automation | null
  commands: AutomationCommand[]
  orchestratorError: string | null
}> => {
  let orchestratorError: string | null = null
  const automation = await getAutomationAction(id).catch(error => {
    orchestratorError = errorMessage(error)
    return null
  })
  if (!automation) {
    if (orchestratorError) {
      return {
        automation: null,
        commands: [],
        orchestratorError
      }
    }

    notFound()
  }

  const commands = await listAutomationCommandsAction().catch(error => {
    orchestratorError ??= errorMessage(error)
    return [] as AutomationCommand[]
  })

  return {
    automation,
    commands,
    orchestratorError
  }
}
