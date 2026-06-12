import { AutomationEditorPage } from '../../automations-page/editor/automation-editor-page'
import { loadAutomationCreatePageData } from './page-data.server'

export async function AutomationCreatePageEntry() {
  const { commands } = await loadAutomationCreatePageData()

  return <AutomationEditorPage initialCommands={commands} />
}
