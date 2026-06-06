import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { AutomationEditorPageSkeleton } from '@/features/automations/automations-page/automation-page-skeletons'
import { AutomationEditorPage } from '@/features/automations/automations-page/editor/automation-editor-page'
import {
  getAutomationAction,
  listAutomationCommandsAction
} from '@/server/orchestrator/automations/automation-management-actions'

const EditAutomationRouteContent = async ({ params }: { params: Promise<{ id: string }> }) => {
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

export default function EditAutomationRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<AutomationEditorPageSkeleton />}>
      <EditAutomationRouteContent params={params} />
    </Suspense>
  )
}
