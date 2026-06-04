import { notFound } from 'next/navigation'
import { AutomationEditorPage } from '@/features/automations/automations-page/automation-editor-page'
import { listApplicationsAction } from '@/server/orchestrator/applications/actions/queries/listing-actions'
import {
  getAutomationAction,
  listAutomationCommandsAction,
  listAutomationRunsAction
} from '@/server/orchestrator/automations/actions'

export default async function EditAutomationRoute({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { id } = await params
  const { view } = await searchParams
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
      initialView={view === 'traces' ? 'traces' : 'builder'}
      initialRuns={runs}
    />
  )
}
