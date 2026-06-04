import { AutomationEditorPage } from '@/features/automations/automations-page/automation-editor-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import { listAutomationCommandsAction } from '@/server/orchestrator/automations/actions'

export default async function NewAutomationRoute() {
  const [commands, applications] = await Promise.all([
    listAutomationCommandsAction(),
    listApplicationsAction({ reconcile: false })
  ])

  return (
    <AutomationEditorPage
      initialApplications={applications}
      initialCommands={commands}
    />
  )
}
