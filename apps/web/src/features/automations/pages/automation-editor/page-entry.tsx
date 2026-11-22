import { Suspense } from 'react'
import { AutomationEditorPageSkeleton } from '../../automations-page/automation-page-skeletons'
import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadWorkflowEditor } from './page-data.server'

type EditorRouteProps = { params?: Promise<{ id: string }> }

async function WorkflowEditorContent({ params }: EditorRouteProps) {
  const id = (await params)?.id
  const result = await loadWorkflowEditor(id)
  if (!result.ok)
    return (
      <AutomationPageUnavailable
        title={id === undefined ? 'New workflow' : 'Workflow'}
        workflow
        requestId={result.requestId}
      />
    )
  return <AutomationEditorPage {...result.data} />
}

export function AutomationEditorPageEntry({ params }: EditorRouteProps) {
  return (
    <Suspense fallback={<AutomationEditorPageSkeleton creating={params === undefined} />}>
      <WorkflowEditorContent params={params} />
    </Suspense>
  )
}
