import { notFound } from 'next/navigation'
import { AutomationEditorPage } from '@/features/automations/automations-page/editor/automation-editor-page'
import {
  getAutomationAction,
  listAutomationCommandsAction
} from '@/server/orchestrator/automations/automation-management-actions'

export default async function EditAutomationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const automation = await getAutomationAction(id).catch(() => null)
  if (!automation) {
    notFound()
  }

  const commands = await listAutomationCommandsAction()

  return (
    <AutomationEditorPage
      initialAutomation={automation}
      initialCommands={commands}
    />
  )
}
