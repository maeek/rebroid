import { notFound } from 'next/navigation'
import { AutomationEditorPage } from '@/features/automations/automations-page/automation-editor-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  getAutomationAction,
  listAutomationCommandsAction,
  listAutomationRunsAction
} from '@/server/orchestrator/automations/actions'

export default async function EditAutomationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const automation = await getAutomationAction(id).catch(() => null)
  if (!automation) {
    notFound()
  }

  const [commands, applications, runs] = await Promise.all([
    listAutomationCommandsAction(),
    listApplicationsAction({ reconcile: false }),
    listAutomationRunsAction(id, 20)
  ])

  return (
    <AutomationEditorPage
      initialApplications={applications}
      initialAutomation={automation}
      initialCommands={commands}
      initialRuns={runs}
    />
  )
}
