import { getCurrentUserContext } from '@/server/orchestrator/current-user'
import { hasPermission } from '@/shared/permissions/permissions'
import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationCreatePageData } from './page-data.server'

export async function AutomationCreatePageEntry() {
  const [{ commands, orchestratorError }, user] = await Promise.all([
    loadAutomationCreatePageData(),
    getCurrentUserContext()
  ])

  if (orchestratorError) {
    return <AutomationPageUnavailable title='New workflow' />
  }

  return (
    <AutomationEditorPage
      initialCommands={commands}
      canUseAi={hasPermission(user.permissions, 'automations:run-ai')}
      canManageAi={user.isPlatformAdmin}
    />
  )
}
