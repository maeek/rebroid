import { AutomationEditorPage } from '@/features/automations/automations-page/editor/automation-editor-page'
import { listAutomationCommandsAction } from '@/server/orchestrator/automations/automation-management-actions'

export default async function CreateAutomationRoute() {
  const commands = await listAutomationCommandsAction()

  return <AutomationEditorPage initialCommands={commands} />
}
