import { Suspense } from 'react'
import { AutomationEditorPageSkeleton } from '../../automations-page/automation-page-skeletons'
import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationEditPageData } from './page-data.server'

const AutomationEditPageContent = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { automation, commands, orchestratorError } = await loadAutomationEditPageData(id)

  if (orchestratorError || !automation) {
    return (
      <AutomationPageUnavailable
        title='Workflow'
        href={`/automations/${id}`}
      />
    )
  }

  return (
    <AutomationEditorPage
      initialAutomation={automation}
      initialCommands={commands}
    />
  )
}

export function AutomationEditPageEntry({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<AutomationEditorPageSkeleton />}>
      <AutomationEditPageContent params={params} />
    </Suspense>
  )
}
