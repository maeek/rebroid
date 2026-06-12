import { notFound } from 'next/navigation'
import {
  getAutomationAction,
  listAutomationCommandsAction
} from '@/server/orchestrator/automations/automation-management-actions'

export const loadAutomationEditPageData = async (id: string) => {
  const automation = await getAutomationAction(id).catch(() => null)
  if (!automation) {
    notFound()
  }

  const commands = await listAutomationCommandsAction()

  return {
    automation,
    commands
  }
}
