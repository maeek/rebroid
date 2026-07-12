import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { AutomationPageUnavailable } from '../../automations-page/shared/automation-page-unavailable'
import { loadAutomationCreatePageData } from './page-data.server'

export async function AutomationCreatePageEntry() {
  const { commands, orchestratorError } = await loadAutomationCreatePageData()

  if (orchestratorError) {
    return (
      <AutomationPageUnavailable
        title='New workflow'
        href='/automations/create'
      />
    )
  }

  return <AutomationEditorPage initialCommands={commands} />
}
