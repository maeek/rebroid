import { Suspense } from 'react'
import { AutomationEditorPageSkeleton } from '../../automations-page/automation-page-skeletons'
import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { loadAutomationEditPageData } from './page-data.server'

const AutomationEditPageContent = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { automation, commands } = await loadAutomationEditPageData(id)

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
