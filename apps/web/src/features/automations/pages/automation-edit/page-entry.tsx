import { Suspense } from 'react'
import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'
import { AutomationEditorPageSkeleton } from '../../automations-page/automation-page-skeletons'
import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationEditPageData } from './page-data.server'

const AutomationEditPageContent = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const [{ automation, commands, orchestratorError }, user] = await Promise.all([
    loadAutomationEditPageData(id),
    getCurrentUserContext()
  ])

  if (orchestratorError || !automation) {
    return (
      <AutomationPageUnavailable
        title='Workflow'
        workflow
      />
    )
  }

  return (
    <AutomationEditorPage
      initialAutomation={automation}
      initialCommands={commands}
      canUseAi={hasPermission(user.permissions, 'automations:run-ai')}
      canManageAi={user.isPlatformAdmin}
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
