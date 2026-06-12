import { listAutomationCommandsAction } from '@/server/orchestrator/automations/automation-management-actions'

export const loadAutomationCreatePageData = async () => ({
  commands: await listAutomationCommandsAction()
})
